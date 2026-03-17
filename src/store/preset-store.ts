import { create } from 'zustand';

export interface Preset {
  id: number;
  name: string;
  category: string;
  type: string | null;
  file_path: string | null;
  metadata: string | null;
  effects_defaults: string | null;
  mode: string | null;
  tags: string | null;
  preset_type: string | null; // 'built-in' | 'user'
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Kicks',
  'Snares',
  'Hi-Hats',
  'Claps',
  'Toms',
  '808s',
  'Piano',
  'Flute',
  'Strings',
  'Brass',
] as const;

interface WlePresetFile {
  name: string;
  category: string;
  effects_defaults: string | null;
  mode: string | null;
}

interface PresetState {
  categories: readonly string[];
  selectedCategory: string | null;
  presets: Preset[];
  presetsLoading: boolean;

  setSelectedCategory: (category: string | null) => void;
  loadPresets: () => Promise<void>;
  deletePreset: (id: number) => Promise<void>;
  importPreset: () => Promise<void>;
  exportPreset: (preset: Preset) => Promise<void>;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  categories: CATEGORIES,
  selectedCategory: null,
  presets: [],
  presetsLoading: false,

  setSelectedCategory: (category) => {
    const current = get().selectedCategory;
    // Toggle: clicking the same category collapses it
    set({ selectedCategory: current === category ? null : category });
  },

  loadPresets: async () => {
    set({ presetsLoading: true });
    try {
      const rows = (await window.electronAPI.getPresets()) as Preset[];
      set({ presets: rows, presetsLoading: false });
    } catch {
      set({ presets: [], presetsLoading: false });
    }
  },

  deletePreset: async (id: number) => {
    await window.electronAPI.deletePreset(id);
    // Remove from local state
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },

  importPreset: async () => {
    const filePath = await window.electronAPI.openPresetFile();
    if (!filePath) return;

    const content = await window.electronAPI.readPresetFile(filePath);
    let data: WlePresetFile;
    try {
      data = JSON.parse(content) as WlePresetFile;
    } catch {
      throw new Error('Invalid preset file: could not parse JSON');
    }

    if (!data.name || !data.category) {
      throw new Error('Invalid preset file: missing required fields');
    }

    await window.electronAPI.savePreset({
      name: data.name,
      category: data.category,
      effects_defaults: data.effects_defaults ?? '{}',
      mode: data.mode ?? 'realistic',
      file_path: null,
    });

    // Reload presets to pick up the new entry
    await get().loadPresets();
  },

  exportPreset: async (preset: Preset) => {
    const safeName = preset.name.replace(/[^a-zA-Z0-9_\- ]/g, '');
    const filePath = await window.electronAPI.savePresetFile(`${safeName}.wlepreset`);
    if (!filePath) return;

    const data: WlePresetFile = {
      name: preset.name,
      category: preset.category,
      effects_defaults: preset.effects_defaults,
      mode: preset.mode,
    };

    await window.electronAPI.writePresetFile(filePath, JSON.stringify(data, null, 2));
  },
}));
