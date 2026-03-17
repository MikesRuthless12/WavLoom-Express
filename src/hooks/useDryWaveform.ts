import { useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useAudioStore } from '../store/audio-store';
import { AudioEngine } from '../audio/engine';
import { audioBufferToWavBlob } from '../audio/wav-encoder';

const DRY_WAVEFORM_OPTIONS = {
  waveColor: '#666666',
  progressColor: '#555555',
  backgroundColor: '#141414',
  height: 75,
  barWidth: 2,
  barGap: 1,
  barRadius: 1,
  cursorColor: '#ffffff80',
  cursorWidth: 1,
  normalize: true,
  interact: true,
  hideScrollbar: true,
  fillParent: true,
} as const;

export function useDryWaveform(containerRef: React.RefObject<HTMLDivElement | null>) {
  const wsRef = useRef<WaveSurfer | null>(null);
  const rafRef = useRef<number>(0);

  const engine = AudioEngine.getInstance();

  const syncProgress = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const duration = engine.getDuration();
    if (duration > 0 && engine.isPlaying()) {
      const progress = engine.getCurrentTime() / duration;
      ws.seekTo(Math.min(progress, 1));
    }
    if (engine.isPlaying()) {
      rafRef.current = requestAnimationFrame(syncProgress);
    }
  }, [engine]);

  // Initialize wavesurfer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dummyMedia = document.createElement('audio');
    dummyMedia.muted = true;
    dummyMedia.volume = 0;

    const ws = WaveSurfer.create({
      container,
      ...DRY_WAVEFORM_OPTIONS,
      media: dummyMedia,
    });

    ws.on('interaction', (newTime: number) => {
      const duration = engine.getDuration();
      if (duration > 0) {
        engine.seekTo(newTime);
      }
    });

    wsRef.current = ws;

    return () => {
      cancelAnimationFrame(rafRef.current);
      ws.destroy();
      wsRef.current = null;
    };
  }, [containerRef, engine]);

  // Load raw buffer (no effects) when buffer changes or abActive turns on
  useEffect(() => {
    const unsub = useAudioStore.subscribe((state, prev) => {
      const bufferChanged = state.currentBuffer && state.currentBuffer !== prev.currentBuffer;
      const abJustActivated = state.abActive && !prev.abActive && state.currentBuffer;
      if (bufferChanged || abJustActivated) {
        loadRawBuffer(state.currentBuffer!);
      }
    });

    const { currentBuffer, abActive } = useAudioStore.getState();
    if (currentBuffer && abActive && wsRef.current) {
      loadRawBuffer(currentBuffer);
    }

    return unsub;

    function loadRawBuffer(buffer: AudioBuffer) {
      const ws = wsRef.current;
      if (!ws) return;
      const wavBlob = audioBufferToWavBlob(buffer);
      ws.loadBlob(wavBlob);
    }
  }, []);

  const startSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(syncProgress);
  }, [syncProgress]);

  const stopSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const ws = wsRef.current;
    if (ws) {
      const duration = engine.getDuration();
      if (duration > 0) {
        ws.seekTo(Math.min(engine.getCurrentTime() / duration, 1));
      }
    }
  }, [engine]);

  return { wsRef, startSync, stopSync };
}
