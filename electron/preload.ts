import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Controls
  minimizeWindow: () => ipcRenderer.send('win:minimize'),
  maximizeWindow: () => ipcRenderer.send('win:maximize'),
  closeWindow: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('win:maximized-changed', handler);
    return () => ipcRenderer.removeListener('win:maximized-changed', handler);
  },

  // Utilities
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // File System
  openFile: () => ipcRenderer.invoke('fs:openFile'),
  openDirectory: () => ipcRenderer.invoke('fs:openDirectory'),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('fs:readAudioFile', filePath),
  writeAudioFile: (filePath: string, data: ArrayBuffer) => ipcRenderer.invoke('fs:writeAudioFile', filePath, data),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  getDefaultExportDir: () => ipcRenderer.invoke('fs:getDefaultExportDir'),
  showSaveDialog: (defaultName: string, format: string) => ipcRenderer.invoke('fs:showSaveDialog', defaultName, format),
  openPresetFile: () => ipcRenderer.invoke('fs:openPresetFile'),
  readPresetFile: (filePath: string) => ipcRenderer.invoke('fs:readPresetFile', filePath),
  savePresetFile: (defaultName: string) => ipcRenderer.invoke('fs:savePresetFile', defaultName),
  writePresetFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writePresetFile', filePath, content),

  // Database — Settings
  getSetting: (key: string) => ipcRenderer.invoke('db:getSetting', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('db:setSetting', key, value),

  // Database — Presets
  getPresets: () => ipcRenderer.invoke('db:getPresets'),
  getPreset: (id: number) => ipcRenderer.invoke('db:getPreset', id),
  savePreset: (data: { name: string; category: string; effects_defaults: string; mode: string; file_path: string | null }) =>
    ipcRenderer.invoke('db:savePreset', data),
  deletePreset: (id: number) => ipcRenderer.invoke('db:deletePreset', id),

  // Database — Analyses
  saveAnalysis: (data: { source_file_path: string; source_file_hash: string; instrument_type: string; spectral_data: string; temporal_data: string; waveform_data: string }) =>
    ipcRenderer.invoke('db:saveAnalysis', data),
  getAnalysisByHash: (hash: string) => ipcRenderer.invoke('db:getAnalysisByHash', hash),
  getAnalysisById: (id: number) => ipcRenderer.invoke('db:getAnalysisById', id),

  // Database — Designs
  saveDesign: (data: { name: string; source_type: string; source_id: number; effects_state: string; mode: string }) =>
    ipcRenderer.invoke('db:saveDesign', data),
  updateDesign: (id: number, data: { name?: string; effects_state?: string; mode?: string; exported_path?: string }) =>
    ipcRenderer.invoke('db:updateDesign', id, data),
  getDesigns: () => ipcRenderer.invoke('db:getDesigns'),
  getLastDesign: () => ipcRenderer.invoke('db:getLastDesign'),

  // Database — Kits
  saveKit: (data: { name: string; description: string; slot_count: number }) =>
    ipcRenderer.invoke('db:saveKit', data),
  updateKit: (id: number, data: { name?: string; description?: string; slot_count?: number; exported_path?: string }) =>
    ipcRenderer.invoke('db:updateKit', id, data),
  updateKitSlots: (kitId: number, slots: Array<{ slot_index: number; design_id: number | null; label: string; sound_name: string | null; file_path: string | null }>) =>
    ipcRenderer.invoke('db:updateKitSlots', kitId, slots),
  getKits: () => ipcRenderer.invoke('db:getKits'),
  getKitWithSlots: (id: number) => ipcRenderer.invoke('db:getKitWithSlots', id),
  deleteKit: (id: number) => ipcRenderer.invoke('db:deleteKit', id),

  // Database — Recent Files
  getRecentFiles: () => ipcRenderer.invoke('db:getRecentFiles'),
  addRecentFile: (data: { file_path: string; file_name: string; file_type: string }) =>
    ipcRenderer.invoke('db:addRecentFile', data),
  deleteRecentFile: (filePath: string) => ipcRenderer.invoke('db:deleteRecentFile', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('db:clearRecentFiles'),

  // FLAC Encoding (main process)
  encodeFlac: (pcmData: ArrayBuffer, sampleRate: number, channels: number, bitsPerSample: number, totalSamples: number) =>
    ipcRenderer.invoke('fs:encodeFlac', pcmData, sampleRate, channels, bitsPerSample, totalSamples),

  // Drag-to-DAW
  exportToTemp: (data: ArrayBuffer, fileName: string) => ipcRenderer.invoke('drag:exportTemp', data, fileName),
  startDrag: (filePath: string) => ipcRenderer.send('drag:start', filePath),
});
