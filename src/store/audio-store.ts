import { create } from 'zustand';
import type { AnalysisResult } from '../audio/analyzer';
import type { AudioMode } from '../audio/modes';
import { clearEffectsUndoStack } from './effects-undo';
import { clearEnvelopeUndoStack } from './envelope-undo';

export interface EffectsState {
  reverb: number;
  delay: number;
  pitch: number;      // -12 to +12 semitones
  distortion: number;
  filter: number;
  volume: number;
  pan: number;         // 0–100, 50 = center
}

export interface EnvelopeState {
  enabled: boolean;
  attack: number;   // ms (0–5000)
  decay: number;    // ms (0–5000)
  sustain: number;  // 0–100 (percentage)
  release: number;  // ms (0–10000)
}

export interface FadeState {
  fadeIn: number;   // 0–1 fraction of duration
  fadeOut: number;  // 0–1 fraction of duration
}

export type SourceType = 'analysis' | 'preset' | null;

interface AudioState {
  currentBuffer: AudioBuffer | null;
  filePath: string;
  fileName: string;
  duration: number;
  sampleRate: number;
  isLoading: boolean;
  error: string | null;
  analysis: AnalysisResult | null;
  effects: EffectsState;
  envelope: EnvelopeState;
  fade: FadeState;
  rootNote: number; // MIDI note number (default 60 = C3)
  mode: AudioMode;
  reversed: boolean;
  abActive: boolean;
  abMode: boolean; // false=A (wet/processed), true=B (dry/original)
  sourceType: SourceType;
  sourceId: number | null;
  currentDesignId: number | null;

  setReversed: (reversed: boolean) => void;
  setCurrentBuffer: (buffer: AudioBuffer, filePath: string, fileName: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  setEffect: (name: keyof EffectsState, value: number) => void;
  restoreEffects: (effects: EffectsState) => void;
  setEnvelope: (params: Partial<EnvelopeState>) => void;
  restoreEnvelope: (envelope: EnvelopeState) => void;
  setFade: (params: Partial<FadeState>) => void;
  setRootNote: (note: number) => void;
  setMode: (mode: AudioMode) => void;
  setABActive: (active: boolean) => void;
  setABMode: (isB: boolean) => void;
  setSource: (sourceType: SourceType, sourceId: number | null) => void;
  setCurrentDesignId: (id: number | null) => void;
  reset: () => void;
}

const defaultEffects: EffectsState = {
  reverb: 0,
  delay: 0,
  pitch: 0,
  distortion: 0,
  filter: 50,
  volume: 50,
  pan: 50,
};

const defaultEnvelope: EnvelopeState = {
  enabled: false,
  attack: 0,
  decay: 0,
  sustain: 100,
  release: 0,
};

const defaultFade: FadeState = {
  fadeIn: 0,
  fadeOut: 0,
};

export const useAudioStore = create<AudioState>((set) => ({
  currentBuffer: null,
  filePath: '',
  fileName: '',
  duration: 0,
  sampleRate: 0,
  isLoading: false,
  error: null,
  analysis: null,
  effects: { ...defaultEffects },
  envelope: { ...defaultEnvelope },
  fade: { ...defaultFade },
  rootNote: 60, // C3
  mode: 'realistic' as AudioMode,
  reversed: false,
  abActive: false,
  abMode: false,
  sourceType: null,
  sourceId: null,
  currentDesignId: null,

  setCurrentBuffer: (buffer, filePath, fileName) =>
    set({
      currentBuffer: buffer,
      filePath,
      fileName,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      isLoading: false,
      error: null,
    }),

  setLoading: (isLoading) => set({ isLoading, error: null }),

  setError: (error) => set({ error, isLoading: false }),

  setAnalysis: (analysis) => set({ analysis }),

  setEffect: (name, value) =>
    set((state) => ({
      effects: { ...state.effects, [name]: value },
      error: null,
    })),

  restoreEffects: (effects) =>
    set({ effects: { ...effects }, error: null }),

  setEnvelope: (params) =>
    set((state) => ({
      envelope: { ...state.envelope, ...params },
      error: null,
    })),

  restoreEnvelope: (envelope) =>
    set({ envelope: { ...envelope }, error: null }),

  setFade: (params) =>
    set((state) => ({
      fade: { ...state.fade, ...params },
      error: null,
    })),

  setRootNote: (rootNote) => set({ rootNote }),

  setReversed: (reversed) => set({ reversed }),

  setMode: (mode) => set({ mode }),

  setABActive: (abActive) => set({ abActive }),
  setABMode: (abMode) => set({ abMode }),
  setSource: (sourceType, sourceId) => set({ sourceType, sourceId, currentDesignId: null }),
  setCurrentDesignId: (currentDesignId) => set({ currentDesignId }),

  reset: () => {
    clearEffectsUndoStack();
    clearEnvelopeUndoStack();
    return set({
      currentBuffer: null,
      filePath: '',
      fileName: '',
      duration: 0,
      sampleRate: 0,
      isLoading: false,
      error: null,
      analysis: null,
      effects: { ...defaultEffects },
      envelope: { ...defaultEnvelope },
      fade: { ...defaultFade },
      rootNote: 60,
      mode: 'realistic' as AudioMode,
      reversed: false,
      abActive: false,
      abMode: false,
      sourceType: null,
      sourceId: null,
      currentDesignId: null,
    });
  },
}));
