/**
 * AudioAnalyzer — spectral and temporal analysis of audio buffers.
 *
 * Computes FFT directly from raw PCM samples around the peak energy region,
 * then extracts spectral features, temporal features, and classifies the
 * instrument type using rule-based heuristics.
 */

export interface AnalysisResult {
  instrumentType: 'kick' | 'snare' | 'hi-hat' | 'unknown';
  spectralCentroid: number;
  spectralBandwidth: number;
  spectralRolloff: number;
  attackTime: number;
  peakAmplitude: number;
  decayRate: number;
  sustainLevel: number;
  spectralData: {
    frequencyPeaks: number[];
    magnitudes: Float32Array;
    binFrequency: number;
  };
  temporalData: {
    envelope: Float32Array;
    attackSampleIndex: number;
    peakSampleIndex: number;
  };
}

export class AudioAnalyzer {
  private fftSize = 2048;

  /**
   * Analyze an AudioBuffer and return spectral + temporal features.
   */
  analyze(audioBuffer: AudioBuffer): AnalysisResult {
    const temporal = this.extractTemporalFeatures(audioBuffer);
    const spectral = this.extractSpectralFeatures(audioBuffer, temporal.peakSampleIndex);
    const instrumentType = this.classifyInstrument(spectral, temporal);

    return {
      instrumentType,
      spectralCentroid: spectral.centroid,
      spectralBandwidth: spectral.bandwidth,
      spectralRolloff: spectral.rolloff,
      attackTime: temporal.attackTime,
      peakAmplitude: temporal.peakAmplitude,
      decayRate: temporal.decayRate,
      sustainLevel: temporal.sustainLevel,
      spectralData: {
        frequencyPeaks: spectral.peaks,
        magnitudes: spectral.magnitudes,
        binFrequency: spectral.binFrequency,
      },
      temporalData: {
        envelope: temporal.envelope,
        attackSampleIndex: temporal.attackSampleIndex,
        peakSampleIndex: temporal.peakSampleIndex,
      },
    };
  }

  /* ── Spectral Features (direct FFT on raw samples) ── */

  private extractSpectralFeatures(audioBuffer: AudioBuffer, peakSampleIndex: number) {
    const sampleRate = audioBuffer.sampleRate;
    const data = audioBuffer.getChannelData(0);
    const N = this.fftSize;

    // Center the FFT window on the peak energy region
    let start = peakSampleIndex - Math.floor(N / 2);
    if (start < 0) start = 0;
    if (start + N > data.length) start = Math.max(0, data.length - N);

    // Extract windowed samples (Hann window)
    const real = new Float64Array(N);
    const imag = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const sample = i + start < data.length ? data[i + start] : 0;
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
      real[i] = sample * hann;
    }

    // In-place Cooley-Tukey FFT
    this.fft(real, imag);

    // Compute magnitudes for positive frequencies
    const binCount = N / 2;
    const magnitudes = new Float32Array(binCount);
    for (let i = 0; i < binCount; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }

    const binFrequency = sampleRate / N;

    const peaks = this.findFrequencyPeaks(magnitudes, binFrequency);
    const centroid = this.computeSpectralCentroid(magnitudes, binFrequency);
    const bandwidth = this.computeSpectralBandwidth(magnitudes, binFrequency, centroid);
    const rolloff = this.computeSpectralRolloff(magnitudes, binFrequency);

    return { peaks, centroid, bandwidth, rolloff, magnitudes, binFrequency };
  }

  /** Radix-2 Cooley-Tukey FFT (in-place). */
  private fft(real: Float64Array, imag: Float64Array): void {
    const N = real.length;

    // Bit-reversal permutation
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      while (j & bit) {
        j ^= bit;
        bit >>= 1;
      }
      j ^= bit;
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }

    // Butterfly stages
    for (let len = 2; len <= N; len *= 2) {
      const halfLen = len / 2;
      const angle = (-2 * Math.PI) / len;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);

      for (let i = 0; i < N; i += len) {
        let curReal = 1;
        let curImag = 0;
        for (let j = 0; j < halfLen; j++) {
          const tReal = curReal * real[i + j + halfLen] - curImag * imag[i + j + halfLen];
          const tImag = curReal * imag[i + j + halfLen] + curImag * real[i + j + halfLen];
          real[i + j + halfLen] = real[i + j] - tReal;
          imag[i + j + halfLen] = imag[i + j] - tImag;
          real[i + j] += tReal;
          imag[i + j] += tImag;
          const newCurReal = curReal * wReal - curImag * wImag;
          curImag = curReal * wImag + curImag * wReal;
          curReal = newCurReal;
        }
      }
    }
  }

  private findFrequencyPeaks(magnitudes: Float32Array, binFrequency: number): number[] {
    const peaks: { freq: number; mag: number }[] = [];

    for (let i = 1; i < magnitudes.length - 1; i++) {
      if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
        peaks.push({ freq: i * binFrequency, mag: magnitudes[i] });
      }
    }

    // Sort by magnitude descending, return top 10 frequencies
    peaks.sort((a, b) => b.mag - a.mag);
    return peaks.slice(0, 10).map((p) => p.freq);
  }

  private computeSpectralCentroid(magnitudes: Float32Array, binFrequency: number): number {
    let weightedSum = 0;
    let totalMag = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      const freq = i * binFrequency;
      weightedSum += freq * magnitudes[i];
      totalMag += magnitudes[i];
    }

    return totalMag > 0 ? weightedSum / totalMag : 0;
  }

  private computeSpectralBandwidth(
    magnitudes: Float32Array,
    binFrequency: number,
    centroid: number,
  ): number {
    let weightedVariance = 0;
    let totalMag = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      const freq = i * binFrequency;
      const diff = freq - centroid;
      weightedVariance += diff * diff * magnitudes[i];
      totalMag += magnitudes[i];
    }

    return totalMag > 0 ? Math.sqrt(weightedVariance / totalMag) : 0;
  }

  private computeSpectralRolloff(magnitudes: Float32Array, binFrequency: number): number {
    let totalEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      totalEnergy += magnitudes[i] * magnitudes[i];
    }

    const threshold = totalEnergy * 0.95;
    let cumulative = 0;

    for (let i = 0; i < magnitudes.length; i++) {
      cumulative += magnitudes[i] * magnitudes[i];
      if (cumulative >= threshold) {
        return i * binFrequency;
      }
    }

    return (magnitudes.length - 1) * binFrequency;
  }

  /* ── Temporal Features ── */

  private extractTemporalFeatures(audioBuffer: AudioBuffer) {
    // Use first channel
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Compute amplitude envelope (RMS over small windows)
    const windowSize = Math.floor(sampleRate * 0.005); // 5ms windows
    const hopSize = windowSize;
    const envelopeLength = Math.floor(data.length / hopSize);
    const envelope = new Float32Array(envelopeLength);

    for (let i = 0; i < envelopeLength; i++) {
      const start = i * hopSize;
      const end = Math.min(start + windowSize, data.length);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += data[j] * data[j];
      }
      envelope[i] = Math.sqrt(sum / (end - start));
    }

    // Peak amplitude (max absolute sample value)
    let peakAmplitude = 0;
    let peakSampleIndex = 0;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peakAmplitude) {
        peakAmplitude = abs;
        peakSampleIndex = i;
      }
    }

    // Attack time: time from start to peak amplitude
    const attackTime = peakSampleIndex / sampleRate;

    // Find peak in envelope
    let peakEnvIdx = 0;
    let peakEnvVal = 0;
    for (let i = 0; i < envelope.length; i++) {
      if (envelope[i] > peakEnvVal) {
        peakEnvVal = envelope[i];
        peakEnvIdx = i;
      }
    }

    // Decay rate: slope of envelope from peak to 10% of peak (or end)
    let decayRate = 0;
    if (peakEnvVal > 0 && peakEnvIdx < envelope.length - 1) {
      const decayThreshold = peakEnvVal * 0.1;
      let decayEndIdx = envelope.length - 1;
      for (let i = peakEnvIdx + 1; i < envelope.length; i++) {
        if (envelope[i] <= decayThreshold) {
          decayEndIdx = i;
          break;
        }
      }
      const decayDuration = (decayEndIdx - peakEnvIdx) * (hopSize / sampleRate);
      if (decayDuration > 0) {
        decayRate = (peakEnvVal - envelope[decayEndIdx]) / decayDuration;
      }
    }

    // Sustain level: average amplitude in the second half after peak
    let sustainLevel = 0;
    const sustainStart = Math.floor(peakEnvIdx + (envelope.length - peakEnvIdx) * 0.5);
    if (sustainStart < envelope.length) {
      let sum = 0;
      const count = envelope.length - sustainStart;
      for (let i = sustainStart; i < envelope.length; i++) {
        sum += envelope[i];
      }
      sustainLevel = count > 0 ? sum / count : 0;
    }

    return {
      attackTime,
      peakAmplitude,
      decayRate,
      sustainLevel,
      envelope,
      attackSampleIndex: peakSampleIndex,
      peakSampleIndex,
    };
  }

  /* ── Instrument Classification ── */

  private classifyInstrument(
    spectral: { centroid: number; peaks: number[]; rolloff: number },
    temporal: { attackTime: number; decayRate: number },
  ): 'kick' | 'snare' | 'hi-hat' | 'unknown' {
    const { centroid, peaks } = spectral;
    const { attackTime } = temporal;

    // Kick: dominant low frequencies (<200Hz)
    // 808s have slower attacks than acoustic kicks, so use centroid as primary signal
    const dominantFreq = peaks.length > 0 ? peaks[0] : 0;
    if (dominantFreq < 200 && centroid < 500) {
      return 'kick';
    }

    // Hi-hat: high-frequency content (>5kHz) with fast attack
    if (centroid > 5000 && attackTime < 0.1) {
      return 'hi-hat';
    }

    // Snare: broadband noise with mid-frequency emphasis (1-5kHz), fast attack
    if (centroid >= 1000 && centroid <= 5000 && attackTime < 0.1) {
      return 'snare';
    }

    return 'unknown';
  }
}
