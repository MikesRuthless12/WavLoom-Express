import { create } from 'zustand';

export interface KitSlotData {
  id: string;
  label: string;
  soundName: string | null;
  filePath: string | null;
}

export interface SavedKitSummary {
  id: number;
  name: string;
  description: string;
  slot_count: number;
  created_at: string;
  updated_at: string;
}

type SlotCount = 8 | 12 | 16;

interface KitState {
  /** Database ID of the current kit, null if not yet saved */
  currentKitId: number | null;
  currentKitName: string;
  slots: KitSlotData[];
  slotCount: SlotCount;
  /** All saved kits from the database */
  savedKits: SavedKitSummary[];

  setKitName: (name: string) => void;
  setSlotCount: (count: SlotCount) => void;
  /** Add a sound to a slot. Returns false if the filePath is already in another slot (duplicate). */
  addSoundToSlot: (index: number, soundName: string, filePath: string) => boolean;
  removeSlot: (index: number) => void;
  reorderSlot: (fromIndex: number, toIndex: number) => void;
  updateSlotLabel: (index: number, label: string) => void;
  /** Check if a filePath already exists in any slot. */
  hasSoundWithPath: (filePath: string) => boolean;

  /** Load the saved kits list from the database */
  loadKits: () => Promise<void>;
  /** Load a specific kit and its slots from the database */
  loadKit: (kitId: number) => Promise<void>;
  /** Create a new empty kit (resets state, does not save to DB until auto-save triggers) */
  newKit: () => void;
  /** Delete a saved kit */
  deleteKit: (kitId: number) => Promise<void>;
}

function createSlots(count: number): KitSlotData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    label: `Slot ${i + 1}`,
    soundName: null,
    filePath: null,
  }));
}

// ── Debounced auto-save ──────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistCurrentKit();
  }, 2000);
}

async function persistCurrentKit() {
  const { currentKitId, currentKitName, slots, slotCount } = useKitStore.getState();

  try {
    let kitId = currentKitId;

    if (kitId === null) {
      // First save — create the kit row
      kitId = await window.electronAPI.saveKit({
        name: currentKitName,
        description: '',
        slot_count: slotCount,
      });
      // Store the ID without triggering another save cycle
      useKitStore.setState({ currentKitId: kitId });
    } else {
      // Update kit metadata
      await window.electronAPI.updateKit(kitId, {
        name: currentKitName,
        slot_count: slotCount,
      });
    }

    // Persist slot data
    await window.electronAPI.updateKitSlots(
      kitId,
      slots.map((s, i) => ({
        slot_index: i,
        design_id: null,
        label: s.label,
        sound_name: s.soundName,
        file_path: s.filePath,
      })),
    );

    // Refresh the saved kits list
    const kits = (await window.electronAPI.getKits()) as SavedKitSummary[];
    useKitStore.setState({ savedKits: kits });
  } catch (err) {
    console.error('Kit auto-save failed:', err);
  }
}

// ── Store ────────────────────────────────────────────────────────────
export const useKitStore = create<KitState>((set, get) => ({
  currentKitId: null,
  currentKitName: 'Untitled Kit',
  slots: createSlots(8),
  slotCount: 8,
  savedKits: [],

  setKitName: (name) => {
    set({ currentKitName: name });
    scheduleSave();
  },

  setSlotCount: (count) => {
    const current = get().slots;
    if (count > current.length) {
      const extra = Array.from({ length: count - current.length }, (_, i) => ({
        id: crypto.randomUUID(),
        label: `Slot ${current.length + i + 1}`,
        soundName: null,
        filePath: null,
      }));
      set({ slotCount: count, slots: [...current, ...extra] });
    } else {
      set({ slotCount: count, slots: current.slice(0, count) });
    }
    scheduleSave();
  },

  addSoundToSlot: (index, soundName, filePath) => {
    const slots = get().slots;
    if (slots.some((s) => s.filePath === filePath)) {
      return false;
    }
    const updated = [...slots];
    if (updated[index]) {
      updated[index] = { ...updated[index], soundName, filePath };
      set({ slots: updated });
      scheduleSave();
      return true;
    }
    return false;
  },

  removeSlot: (index) => {
    const slots = [...get().slots];
    if (slots[index]) {
      slots[index] = { ...slots[index], soundName: null, filePath: null };
      set({ slots });
      scheduleSave();
    }
  },

  reorderSlot: (fromIndex, toIndex) => {
    const slots = [...get().slots];
    const [moved] = slots.splice(fromIndex, 1);
    slots.splice(toIndex, 0, moved);
    set({ slots });
    scheduleSave();
  },

  updateSlotLabel: (index, label) => {
    const slots = [...get().slots];
    if (slots[index]) {
      slots[index] = { ...slots[index], label };
      set({ slots });
      scheduleSave();
    }
  },

  hasSoundWithPath: (filePath) => {
    return get().slots.some((s) => s.filePath === filePath);
  },

  loadKits: async () => {
    try {
      const kits = (await window.electronAPI.getKits()) as SavedKitSummary[];
      set({ savedKits: kits });
    } catch (err) {
      console.error('Failed to load kits:', err);
    }
  },

  loadKit: async (kitId) => {
    try {
      const result = (await window.electronAPI.getKitWithSlots(kitId)) as {
        id: number;
        name: string;
        description: string;
        slot_count: number;
        slots: Array<{
          slot_index: number;
          label: string;
          sound_name: string | null;
          file_path: string | null;
        }>;
      } | null;
      if (!result) return;

      const slotCount = (result.slot_count as SlotCount) || 8;
      const slots: KitSlotData[] = Array.from({ length: slotCount }, (_, i) => {
        const dbSlot = result.slots.find((s) => s.slot_index === i);
        return {
          id: crypto.randomUUID(),
          label: dbSlot?.label ?? `Slot ${i + 1}`,
          soundName: dbSlot?.sound_name ?? null,
          filePath: dbSlot?.file_path ?? null,
        };
      });

      set({
        currentKitId: result.id,
        currentKitName: result.name,
        slotCount,
        slots,
      });
    } catch (err) {
      console.error('Failed to load kit:', err);
    }
  },

  newKit: () => {
    set({
      currentKitId: null,
      currentKitName: 'Untitled Kit',
      slotCount: 8,
      slots: createSlots(8),
    });
  },

  deleteKit: async (kitId) => {
    try {
      await window.electronAPI.deleteKit(kitId);
      const { currentKitId } = get();
      if (currentKitId === kitId) {
        // Reset to a new empty kit if the active kit was deleted
        get().newKit();
      }
      // Refresh list
      const kits = (await window.electronAPI.getKits()) as SavedKitSummary[];
      set({ savedKits: kits });
    } catch (err) {
      console.error('Failed to delete kit:', err);
    }
  },
}));

// ── Startup: load saved kits ─────────────────────────────────────────
useKitStore.getState().loadKits();
