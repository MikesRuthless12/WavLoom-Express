export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isAudio: boolean;
}

interface AnalysisData {
  source_file_path: string;
  source_file_hash: string;
  instrument_type: string;
  spectral_data: string;
  temporal_data: string;
  waveform_data: string;
}

interface DesignData {
  name: string;
  source_type: string;
  source_id: number;
  effects_state: string;
  mode: string;
}

interface DesignUpdate {
  name?: string;
  effects_state?: string;
  mode?: string;
  exported_path?: string;
}

interface KitData {
  name: string;
  description: string;
  slot_count: number;
}

interface KitSlot {
  slot_index: number;
  design_id: number | null;
  label: string;
  sound_name: string | null;
  file_path: string | null;
}

interface RecentFileData {
  file_path: string;
  file_name: string;
  file_type: string;
}

interface ElectronAPI {
  // Window Controls
  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(callback: (maximized: boolean) => void): () => void;

  // Utilities
  getPathForFile(file: File): string;

  // File System
  openFile(): Promise<string | null>;
  openDirectory(): Promise<string | null>;
  readDirectory(dirPath: string): Promise<DirectoryEntry[]>;
  readAudioFile(filePath: string): Promise<ArrayBuffer>;
  writeAudioFile(filePath: string, data: ArrayBuffer): Promise<void>;
  createDirectory(dirPath: string): Promise<void>;
  getDefaultExportDir(): Promise<string>;
  showSaveDialog(defaultName: string, format: string): Promise<string | null>;
  openPresetFile(): Promise<string | null>;
  readPresetFile(filePath: string): Promise<string>;
  savePresetFile(defaultName: string): Promise<string | null>;
  writePresetFile(filePath: string, content: string): Promise<void>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Presets
  getPresets(): Promise<unknown[]>;
  getPreset(id: number): Promise<unknown | null>;
  savePreset(data: { name: string; category: string; effects_defaults: string; mode: string; file_path: string | null }): Promise<number>;
  deletePreset(id: number): Promise<void>;

  // Analyses
  saveAnalysis(data: AnalysisData): Promise<number>;
  getAnalysisByHash(hash: string): Promise<unknown | null>;
  getAnalysisById(id: number): Promise<unknown | null>;

  // Designs
  saveDesign(data: DesignData): Promise<number>;
  updateDesign(id: number, data: DesignUpdate): Promise<void>;
  getDesigns(): Promise<unknown[]>;
  getLastDesign(): Promise<unknown | null>;

  // Kits
  saveKit(data: KitData): Promise<number>;
  updateKit(id: number, data: { name?: string; description?: string; slot_count?: number; exported_path?: string }): Promise<void>;
  updateKitSlots(kitId: number, slots: KitSlot[]): Promise<void>;
  getKits(): Promise<unknown[]>;
  getKitWithSlots(id: number): Promise<unknown | null>;
  deleteKit(id: number): Promise<void>;

  // Recent Files
  getRecentFiles(): Promise<unknown[]>;
  addRecentFile(data: RecentFileData): Promise<void>;
  deleteRecentFile(filePath: string): Promise<void>;
  clearRecentFiles(): Promise<void>;

  // FLAC Encoding (main process)
  encodeFlac(pcmData: ArrayBuffer, sampleRate: number, channels: number, bitsPerSample: number, totalSamples: number): Promise<ArrayBuffer>;

  // Drag-to-DAW
  exportToTemp(data: ArrayBuffer, fileName: string): Promise<string>;
  startDrag(filePath: string): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
