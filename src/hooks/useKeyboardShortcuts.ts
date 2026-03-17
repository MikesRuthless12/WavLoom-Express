import { useEffect } from 'react';
import { AudioEngine } from '../audio/engine';
import { useAudioStore } from '../store/audio-store';
import { undoEffects, redoEffects } from '../store/effects-undo';
import { undoEnvelope, redoEnvelope } from '../store/envelope-undo';
import type { EffectsState, EnvelopeState } from '../store/audio-store';

interface ShortcutHandlers {
  onPlayPause?: () => void;
  onExport?: () => void;
  onOpenFile?: () => void;
  onEscape?: () => void;
}

function applyEffectsToEngine(effects: EffectsState): void {
  const engine = AudioEngine.getInstance();
  engine.setReverbAmount(effects.reverb);
  engine.setDelayAmount(effects.delay);
  engine.setPitchAmount(effects.pitch);
  engine.setDistortionAmount(effects.distortion);
  engine.setFilterAmount(effects.filter);
  engine.setVolumeAmount(effects.volume);
  engine.setPanAmount(effects.pan);
}

function applyEnvelopeToEngine(envelope: EnvelopeState): void {
  const engine = AudioEngine.getInstance();
  const hasNonDefault = envelope.attack > 0 || envelope.decay > 0 || envelope.sustain < 100 || envelope.release > 0;
  engine.setEnvelopeEnabled(envelope.enabled || hasNonDefault);
  engine.setEnvelopeParams({
    attack: envelope.attack / 1000,
    decay: envelope.decay / 1000,
    sustain: envelope.sustain / 100,
    release: envelope.release / 1000,
  });
}

export function useKeyboardShortcuts({
  onPlayPause,
  onExport,
  onOpenFile,
  onEscape,
}: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isMod = e.ctrlKey || e.metaKey;

      // Space = play/pause
      if (e.code === 'Space' && !isMod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const hasBuffer = useAudioStore.getState().currentBuffer !== null;
        if (!hasBuffer) return;

        if (onPlayPause) {
          onPlayPause();
        } else {
          const engine = AudioEngine.getInstance();
          if (engine.isPlaying()) {
            engine.pause();
          } else {
            engine.play();
          }
        }
        return;
      }

      // Ctrl/Cmd+E = export
      if (e.code === 'KeyE' && isMod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const hasBuffer = useAudioStore.getState().currentBuffer !== null;
        if (!hasBuffer) return;
        onExport?.();
        return;
      }

      // Ctrl/Cmd+O = open file
      if (e.code === 'KeyO' && isMod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpenFile?.();
        return;
      }

      // Ctrl/Cmd+Z = undo (effects + envelope)
      if (e.code === 'KeyZ' && isMod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const state = useAudioStore.getState();
        const effSnap = undoEffects(state.effects);
        const envSnap = undoEnvelope(state.envelope);
        if (!effSnap && !envSnap) return;
        if (effSnap) {
          state.restoreEffects(effSnap);
          applyEffectsToEngine(effSnap);
        }
        if (envSnap) {
          state.restoreEnvelope(envSnap);
          applyEnvelopeToEngine(envSnap);
        }
        return;
      }

      // Ctrl/Cmd+Shift+Z = redo (effects + envelope)
      if (e.code === 'KeyZ' && isMod && e.shiftKey && !e.altKey) {
        e.preventDefault();
        const state = useAudioStore.getState();
        const effSnap = redoEffects(state.effects);
        const envSnap = redoEnvelope(state.envelope);
        if (!effSnap && !envSnap) return;
        if (effSnap) {
          state.restoreEffects(effSnap);
          applyEffectsToEngine(effSnap);
        }
        if (envSnap) {
          state.restoreEnvelope(envSnap);
          applyEnvelopeToEngine(envSnap);
        }
        return;
      }

      // Escape = close any open modal/dialog
      if (e.code === 'Escape' && !isMod && !e.shiftKey && !e.altKey) {
        onEscape?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPlayPause, onExport, onOpenFile, onEscape]);
}
