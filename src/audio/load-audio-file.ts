import { useAudioStore } from '../store/audio-store';
import { AudioEngine } from './engine';
import { AudioAnalyzer, type AnalysisResult } from './analyzer';

/**
 * Shared audio file loading pipeline:
 * read → hash → cache check → decode → analyze → store → DB save
 */
export async function loadAudioFile(filePath: string): Promise<void> {
  const store = useAudioStore.getState();
  const engine = AudioEngine.getInstance();

  store.setLoading(true);

  try {
    const arrayBuffer = await window.electronAPI.readAudioFile(filePath);

    // Hash before decoding (decodeAudioData detaches the buffer)
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer.slice(0));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Check cache before decoding + analyzing
    const cached = await window.electronAPI.getAnalysisByHash(hash);

    const buffer = await engine.loadFile(arrayBuffer);

    // Empty file check (decoded buffer has zero length)
    if (buffer.length === 0) {
      store.setError('Empty file.');
      return;
    }

    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
    store.setReversed(false);
    store.setCurrentBuffer(buffer, filePath, fileName);

    // Track in recent files
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
    window.electronAPI.addRecentFile({
      file_path: filePath,
      file_name: fileName,
      file_type: ext,
    });

    let analysis: AnalysisResult;
    let analysisId: number | null = null;

    if (cached) {
      // Reconstruct AnalysisResult from cached DB row
      const cachedRow = cached as Record<string, unknown>;
      analysis = reconstructAnalysis(cachedRow);
      analysisId = cachedRow.id as number;
    } else {
      // Run fresh analysis
      const analyzer = new AudioAnalyzer();
      analysis = analyzer.analyze(buffer);

      // Save to SQLite
      analysisId = (await window.electronAPI.saveAnalysis({
        source_file_path: filePath,
        source_file_hash: hash,
        instrument_type: analysis.instrumentType,
        spectral_data: JSON.stringify({
          centroid: analysis.spectralCentroid,
          bandwidth: analysis.spectralBandwidth,
          rolloff: analysis.spectralRolloff,
          frequencyPeaks: analysis.spectralData.frequencyPeaks,
        }),
        temporal_data: JSON.stringify({
          attackTime: analysis.attackTime,
          peakAmplitude: analysis.peakAmplitude,
          decayRate: analysis.decayRate,
          sustainLevel: analysis.sustainLevel,
        }),
        waveform_data: JSON.stringify({
          envelopeLength: analysis.temporalData.envelope.length,
        }),
      })) as number;
    }

    store.setSource('analysis', analysisId);
    store.setAnalysis(analysis);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('FILE_NOT_FOUND')) {
      // Auto-remove missing files from recent history
      window.electronAPI.deleteRecentFile(filePath);
      store.setError('File not found. It may have been moved or deleted.');
    } else if (msg.includes('FILE_TOO_LARGE')) {
      store.setError('File too large. Max 50MB.');
    } else if (msg.includes('FILE_EMPTY')) {
      store.setError('Empty file.');
    } else {
      // Check extension for unsupported format hint
      const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
      const supported = ['.wav', '.mp3', '.flac'];
      if (!supported.includes(ext)) {
        store.setError('Unsupported format. Try WAV, MP3, or FLAC.');
      } else {
        store.setError("Can't read this file.");
      }
    }
  }
}

/**
 * Reconstruct an AnalysisResult from a cached database row.
 * The DB stores JSON strings for spectral/temporal/waveform data.
 */
function reconstructAnalysis(row: Record<string, unknown>): AnalysisResult {
  const spectral = JSON.parse(row.spectral_data as string) as {
    centroid: number;
    bandwidth: number;
    rolloff: number;
    frequencyPeaks: number[];
  };
  const temporal = JSON.parse(row.temporal_data as string) as {
    attackTime: number;
    peakAmplitude: number;
    decayRate: number;
    sustainLevel: number;
  };
  const waveform = JSON.parse(row.waveform_data as string) as {
    envelopeLength: number;
  };

  return {
    instrumentType: row.instrument_type as AnalysisResult['instrumentType'],
    spectralCentroid: spectral.centroid,
    spectralBandwidth: spectral.bandwidth,
    spectralRolloff: spectral.rolloff,
    attackTime: temporal.attackTime,
    peakAmplitude: temporal.peakAmplitude,
    decayRate: temporal.decayRate,
    sustainLevel: temporal.sustainLevel,
    spectralData: {
      frequencyPeaks: spectral.frequencyPeaks,
      magnitudes: new Float32Array(0), // Not stored in cache
      binFrequency: 0,
    },
    temporalData: {
      envelope: new Float32Array(waveform.envelopeLength),
      attackSampleIndex: 0,
      peakSampleIndex: 0,
    },
  };
}
