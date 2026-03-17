import { useEffect, useRef, useCallback, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap';
import { useAudioStore, EffectsState, EnvelopeState, FadeState } from '../store/audio-store';
import { AudioEngine } from '../audio/engine';
import { audioBufferToWavBlob } from '../audio/wav-encoder';

const WAVEFORM_OPTIONS = {
  waveColor: '#39FF14',
  progressColor: '#32E612',
  backgroundColor: '#141414',
  height: 150,
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

/** Debounce delay for effect-change waveform updates (ms). */
const EFFECTS_DEBOUNCE_MS = 150;
const MAX_ZOOM_FACTOR = 20;
const MINIMAP_THRESHOLD = 2;

export function useWaveform(
  containerRef: React.RefObject<HTMLDivElement | null>,
  minimapContainerRef?: React.RefObject<HTMLDivElement | null>,
) {
  const wsRef = useRef<WaveSurfer | null>(null);
  const rafRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderIdRef = useRef(0);
  const baseRateRef = useRef(0);
  const minimapPluginRef = useRef<MinimapPlugin | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const engine = AudioEngine.getInstance();

  // Sync wavesurfer progress with engine playback via rAF
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

  // Render the buffer through effects and reload wavesurfer
  const renderAndLoad = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws) return;

    const id = ++renderIdRef.current;
    const processed = await engine.renderProcessed();
    // Discard if a newer render was started while we were rendering
    if (id !== renderIdRef.current) return;
    if (!processed) return;

    // Preserve playback position across waveform reload
    const duration = engine.getDuration();
    const currentProgress = duration > 0 ? engine.getCurrentTime() / duration : 0;

    const wavBlob = audioBufferToWavBlob(processed);
    ws.loadBlob(wavBlob);

    // Restore cursor position after wavesurfer finishes loading
    ws.once('ready', () => {
      if (id === renderIdRef.current && currentProgress > 0) {
        ws.seekTo(Math.min(currentProgress, 1));
      }
    });
  }, [engine]);

  // Debounced version for effect changes
  const scheduleRender = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(renderAndLoad, EFFECTS_DEBOUNCE_MS);
  }, [renderAndLoad]);

  // Initialize wavesurfer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dummyMedia = document.createElement('audio');
    dummyMedia.muted = true;
    dummyMedia.volume = 0;

    const ws = WaveSurfer.create({
      container,
      ...WAVEFORM_OPTIONS,
      media: dummyMedia,
      plugins: [
        ZoomPlugin.create({
          scale: 0.5,
          deltaThreshold: 5,
          exponentialZooming: true,
          iterations: 20,
          maxZoom: 50000,
        }),
      ],
    });

    // Compute base pixels-per-second when audio loads
    ws.on('ready', () => {
      const duration = ws.getDuration();
      if (duration > 0) {
        baseRateRef.current = container.clientWidth / duration;
      }
    });

    // Track zoom level and clamp to max
    ws.on('zoom', (minPxPerSec: number) => {
      if (baseRateRef.current <= 0) return;
      const factor = minPxPerSec / baseRateRef.current;
      if (factor > MAX_ZOOM_FACTOR) {
        ws.zoom(baseRateRef.current * MAX_ZOOM_FACTOR);
        return;
      }
      setZoomLevel(Math.max(1, factor));
    });

    // Use 'interaction' instead of 'seeking' — only fires on user clicks/drags,
    // never on programmatic seekTo calls, preventing the feedback loop.
    ws.on('interaction', (newTime: number) => {
      const duration = engine.getDuration();
      if (duration > 0) {
        engine.seekTo(newTime);
      }
    });

    wsRef.current = ws;

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (minimapPluginRef.current) {
        minimapPluginRef.current.destroy();
        minimapPluginRef.current = null;
      }
      ws.destroy();
      wsRef.current = null;
    };
  }, [containerRef, engine]);

  // Manage minimap plugin based on zoom level
  useEffect(() => {
    const ws = wsRef.current;
    const minimapContainer = minimapContainerRef?.current;
    if (!ws) return;

    if (zoomLevel > MINIMAP_THRESHOLD && !minimapPluginRef.current && minimapContainer) {
      minimapPluginRef.current = ws.registerPlugin(
        MinimapPlugin.create({
          container: minimapContainer,
          height: 30,
          waveColor: '#39FF1480',
          progressColor: '#32E61280',
          overlayColor: 'rgba(57, 255, 20, 0.12)',
          cursorColor: 'transparent',
          cursorWidth: 0,
          normalize: true,
          barWidth: 1,
          barGap: 0,
        }),
      );
    } else if (zoomLevel <= MINIMAP_THRESHOLD && minimapPluginRef.current) {
      minimapPluginRef.current.destroy();
      minimapPluginRef.current = null;
      if (minimapContainer) minimapContainer.innerHTML = '';
    }
  }, [zoomLevel, minimapContainerRef]);

  // Load buffer into wavesurfer when audio store changes
  useEffect(() => {
    const unsub = useAudioStore.subscribe((state, prev) => {
      if (state.currentBuffer && state.currentBuffer !== prev.currentBuffer) {
        // Reset zoom when new file loaded
        const ws = wsRef.current;
        if (ws) {
          ws.zoom(0);
          setZoomLevel(1);
        }
        scheduleRender();
      }
    });

    // Also load if buffer already present at mount
    const { currentBuffer } = useAudioStore.getState();
    if (currentBuffer && wsRef.current) {
      scheduleRender();
    }

    return unsub;
  }, [scheduleRender]);

  // Re-render waveform when any effect parameter changes
  useEffect(() => {
    let prevEffects: EffectsState | null = null;
    let prevEnvelope: EnvelopeState | null = null;
    let prevFade: FadeState | null = null;

    const unsub = useAudioStore.subscribe((state) => {
      // Only trigger if there's a buffer loaded and something actually changed
      if (!state.currentBuffer) return;

      const effectsChanged = !prevEffects || !effectsEqual(prevEffects, state.effects);
      const envelopeChanged = !prevEnvelope || !envelopeEqual(prevEnvelope, state.envelope);
      const fadeChanged = !prevFade || !fadeEqual(prevFade, state.fade);

      if (effectsChanged || envelopeChanged || fadeChanged) {
        prevEffects = state.effects;
        prevEnvelope = state.envelope;
        prevFade = state.fade;
        scheduleRender();
      }
    });

    return unsub;
  }, [scheduleRender]);

  // Start/stop progress sync when engine play state changes
  const startSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(syncProgress);
  }, [syncProgress]);

  const stopSync = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    // Update final position
    const ws = wsRef.current;
    if (ws) {
      const duration = engine.getDuration();
      if (duration > 0) {
        ws.seekTo(Math.min(engine.getCurrentTime() / duration, 1));
      }
    }
  }, [engine]);

  return { wsRef, startSync, stopSync, zoomLevel };
}

/** Shallow-compare two EffectsState objects. */
function effectsEqual(a: EffectsState, b: EffectsState): boolean {
  return (
    a.reverb === b.reverb &&
    a.delay === b.delay &&
    a.pitch === b.pitch &&
    a.distortion === b.distortion &&
    a.filter === b.filter &&
    a.volume === b.volume &&
    a.pan === b.pan
  );
}

function envelopeEqual(a: EnvelopeState, b: EnvelopeState): boolean {
  return (
    a.enabled === b.enabled &&
    a.attack === b.attack &&
    a.decay === b.decay &&
    a.sustain === b.sustain &&
    a.release === b.release
  );
}

function fadeEqual(a: FadeState, b: FadeState): boolean {
  return a.fadeIn === b.fadeIn && a.fadeOut === b.fadeOut;
}
