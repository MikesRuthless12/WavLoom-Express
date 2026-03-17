import { useEffect, useRef } from 'react';
import { useAudioStore, type EffectsState, type EnvelopeState, type FadeState } from '../store/audio-store';
import type { AudioMode } from '../audio/modes';

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

interface DesignSnapshot {
  effects: EffectsState;
  envelope: EnvelopeState;
  fade: FadeState;
  rootNote: number;
  mode: AudioMode;
  sourceType: string | null;
  sourceId: number | null;
  fileName: string;
  filePath: string;
}

function snapshotsEqual(a: DesignSnapshot | null, b: DesignSnapshot): boolean {
  if (!a) return false;
  return (
    a.mode === b.mode &&
    a.sourceType === b.sourceType &&
    a.sourceId === b.sourceId &&
    a.fileName === b.fileName &&
    a.filePath === b.filePath &&
    a.rootNote === b.rootNote &&
    a.effects.reverb === b.effects.reverb &&
    a.effects.delay === b.effects.delay &&
    a.effects.pitch === b.effects.pitch &&
    a.effects.distortion === b.effects.distortion &&
    a.effects.filter === b.effects.filter &&
    a.effects.volume === b.effects.volume &&
    a.effects.pan === b.effects.pan &&
    a.envelope.enabled === b.envelope.enabled &&
    a.envelope.attack === b.envelope.attack &&
    a.envelope.decay === b.envelope.decay &&
    a.envelope.sustain === b.envelope.sustain &&
    a.envelope.release === b.envelope.release &&
    a.fade.fadeIn === b.fade.fadeIn &&
    a.fade.fadeOut === b.fade.fadeOut
  );
}

export function useAutoSave() {
  const lastSaved = useRef<DesignSnapshot | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const state = useAudioStore.getState();

      // Only auto-save if there's an active source (user has loaded something)
      if (!state.sourceType || !state.sourceId) return;

      const snapshot: DesignSnapshot = {
        effects: { ...state.effects },
        envelope: { ...state.envelope },
        fade: { ...state.fade },
        rootNote: state.rootNote,
        mode: state.mode,
        sourceType: state.sourceType,
        sourceId: state.sourceId,
        fileName: state.fileName,
        filePath: state.filePath,
      };

      // Skip if nothing changed since last save
      if (snapshotsEqual(lastSaved.current, snapshot)) return;

      const effectsJson = JSON.stringify({
        ...snapshot.effects,
        envelope: snapshot.envelope,
        fade: snapshot.fade,
        rootNote: snapshot.rootNote,
      });
      const name = snapshot.fileName || 'Untitled';

      try {
        if (state.currentDesignId) {
          await window.electronAPI.updateDesign(state.currentDesignId, {
            effects_state: effectsJson,
            mode: snapshot.mode,
            name,
          });
        } else {
          const id = await window.electronAPI.saveDesign({
            name,
            source_type: snapshot.sourceType!,
            source_id: snapshot.sourceId!,
            effects_state: effectsJson,
            mode: snapshot.mode,
          });
          useAudioStore.getState().setCurrentDesignId(id);
        }
        lastSaved.current = snapshot;
      } catch {
        // Silently ignore auto-save failures
      }
    }, AUTO_SAVE_INTERVAL);

    return () => clearInterval(interval);
  }, []);
}
