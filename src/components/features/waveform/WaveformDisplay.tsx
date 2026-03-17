import { useRef, useState, useCallback, useEffect, useImperativeHandle, forwardRef, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useWaveform } from '../../../hooks/useWaveform';
import { useDryWaveform } from '../../../hooks/useDryWaveform';
import { useAudioStore } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';
import EnvelopeEditor from '../effects/EnvelopeEditor';
import FadeHandles from './FadeHandles';

/** Encode an AudioBuffer to WAV ArrayBuffer for WaveSurfer reload */
function encodeWavForDisplay(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const dataSize = length * numChannels * bytesPerSample;
  const headerSize = 44;
  const out = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(out);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return out;
}

export interface WaveformDisplayHandle {
  togglePlayPause: () => void;
}

interface WaveformDisplayProps {
  onDragStart?: (e: DragEvent) => void;
  onMouseDown?: () => void;
}

const WaveformDisplay = forwardRef<WaveformDisplayHandle, WaveformDisplayProps>(
  function WaveformDisplay({ onDragStart, onMouseDown }, ref) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const dryContainerRef = useRef<HTMLDivElement>(null);
    const minimapContainerRef = useRef<HTMLDivElement>(null);
    const { wsRef, startSync, stopSync, zoomLevel } = useWaveform(containerRef, minimapContainerRef);
    const { wsRef: dryWsRef, startSync: dryStartSync, stopSync: dryStopSync } = useDryWaveform(dryContainerRef);
    const engine = AudioEngine.getInstance();

    const [playing, setPlaying] = useState(false);
    const abActive = useAudioStore((s) => s.abActive);
    const reversed = useAudioStore((s) => s.reversed);
    const setReversed = useAudioStore((s) => s.setReversed);

    // Resize waveforms when A/B toggled
    useEffect(() => {
      const height = abActive ? 75 : 150;
      if (wsRef.current) {
        wsRef.current.setOptions({ height });
      }
      if (dryWsRef.current) {
        dryWsRef.current.setOptions({ height: 75 });
      }
    }, [abActive, wsRef, dryWsRef]);

    // Reset playing state when a new buffer is loaded
    const currentBuffer = useAudioStore((s) => s.currentBuffer);
    useEffect(() => {
      // engine.loadFile() calls stop() internally, so engine is never playing here
      setPlaying(false);
      stopSync();
      dryStopSync();
    }, [currentBuffer, stopSync, dryStopSync]);

    // Reset UI when playback ends naturally
    useEffect(() => {
      engine.onEnded(() => {
        setPlaying(false);
        stopSync();
        dryStopSync();
      });
      return () => engine.onEnded(null);
    }, [engine, stopSync, dryStopSync]);

    const handlePlay = useCallback(() => {
      engine.play();
      setPlaying(true);
      startSync();
      dryStartSync();
    }, [engine, startSync, dryStartSync]);

    const handlePause = useCallback(() => {
      engine.pause();
      setPlaying(false);
      stopSync();
      dryStopSync();
    }, [engine, stopSync, dryStopSync]);

    const handleStop = useCallback(() => {
      engine.stop();
      setPlaying(false);
      stopSync();
      dryStopSync();
    }, [engine, stopSync, dryStopSync]);

    const togglePlayPause = useCallback(() => {
      if (engine.isPlaying()) {
        handlePause();
      } else {
        handlePlay();
      }
    }, [engine, handlePlay, handlePause]);

    const handleReverse = useCallback(() => {
      const newReversed = !reversed;
      setReversed(newReversed);
      const buf = engine.reverseBuffer();
      if (buf && wsRef.current) {
        // Reload the reversed buffer into the waveform display
        wsRef.current.loadBlob(new Blob([encodeWavForDisplay(buf)], { type: 'audio/wav' }));
      }
    }, [reversed, setReversed, engine, wsRef]);

    useImperativeHandle(ref, () => ({ togglePlayPause }), [togglePlayPause]);

    return (
      <div className="flex flex-col gap-2 h-full">
        {/* Minimap overview — visible when zoomed > 2x */}
        <div
          ref={minimapContainerRef}
          className="w-full rounded"
          style={{
            backgroundColor: '#141414',
            height: zoomLevel > 2 ? 30 : 0,
            overflow: 'hidden',
            transition: 'height 0.2s ease',
          }}
        />

        {/* Waveform area — only this part is draggable for kit slots */}
        <div
          className="flex-1 flex flex-col gap-0.5 min-h-0 cursor-grab active:cursor-grabbing"
          draggable={!!onDragStart}
          onDragStart={onDragStart}
          onMouseDown={onMouseDown}
        >
          {/* Dry/original waveform (gray) — always mounted, shown when A/B active */}
          <div className="relative" style={{ display: abActive ? 'block' : 'none' }}>
            <div
              ref={dryContainerRef}
              className="w-full rounded"
              style={{ backgroundColor: '#141414', height: 75 }}
            />
            <span className="absolute top-1 left-2 text-[10px] font-mono text-text-muted opacity-60">
              {t('waveform.originalLabel')}
            </span>
          </div>

          {/* Processed waveform (green) with fade handles overlay */}
          <div className="relative overflow-hidden">
            <div
              ref={containerRef}
              className="w-full rounded flex-1"
              style={{ backgroundColor: '#141414', minHeight: abActive ? 75 : 150 }}
            />
            <FadeHandles />
            {abActive && (
              <span className="absolute top-1 left-2 text-[10px] font-mono text-primary opacity-60">
                {t('waveform.processedLabel')}
              </span>
            )}
          </div>
        </div>

        {/* Envelope editor — NOT draggable */}
        <EnvelopeEditor />

        {/* Transport controls */}
        <div className="flex items-center gap-2">
          {zoomLevel > 1.05 && (
            <span className="text-[10px] font-mono text-text-muted tabular-nums mr-auto">
              {zoomLevel.toFixed(1)}x
            </span>
          )}
          {!playing ? (
            <button
              onClick={handlePlay}
              className="flex items-center justify-center w-11 h-11 rounded-sm border border-border bg-surface hover:border-primary hover:text-primary text-text-secondary transition-colors"
              title={t('waveform.play')}
              aria-label={t('waveform.play')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5v11l9-5.5L3 1.5z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center justify-center w-11 h-11 rounded-sm border border-primary bg-primary-muted text-primary transition-colors"
              title={t('waveform.pause')}
              aria-label={t('waveform.pause')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="3" y="2" width="3" height="10" rx="0.5" />
                <rect x="8" y="2" width="3" height="10" rx="0.5" />
              </svg>
            </button>
          )}

          <button
            onClick={handleStop}
            className="flex items-center justify-center w-11 h-11 rounded-sm border border-border bg-surface hover:border-text-muted hover:text-text-secondary text-text-muted transition-colors"
            title={t('waveform.stop')}
            aria-label={t('waveform.stop')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="3" y="3" width="8" height="8" rx="1" />
            </svg>
          </button>

          <button
            onClick={handleReverse}
            className={`flex items-center justify-center w-11 h-11 rounded-sm border transition-colors ${
              reversed
                ? 'border-primary bg-primary-muted text-primary'
                : 'border-border bg-surface hover:border-text-muted hover:text-text-secondary text-text-muted'
            }`}
            title={t('waveform.reverse')}
            aria-label={t('waveform.reverseAria')}
            aria-pressed={reversed}
          >
            <Undo2 size={14} />
          </button>
        </div>
      </div>
    );
  },
);

export default WaveformDisplay;
