import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { initDatabase, closeDatabase } from './ipc/database';
import { registerFileSystemHandlers } from './ipc/file-system';
import { registerDatabaseHandlers } from './ipc/database-handlers';

const tempDragFiles: string[] = [];
let dragIcon: Electron.NativeImage | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'preload.cjs');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    frame: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath,
    },
  });

  // Window control IPC handlers
  ipcMain.on('win:minimize', () => win.minimize());
  ipcMain.on('win:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('win:close', () => win.close());
  ipcMain.handle('win:isMaximized', () => win.isMaximized());

  // Drag-to-DAW: write WAV to temp directory
  ipcMain.handle('drag:exportTemp', async (_event, data: ArrayBuffer, fileName: string) => {
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const tempPath = path.join(os.tmpdir(), `wavloom-${Date.now()}-${safeName}.wav`);
    fs.writeFileSync(tempPath, Buffer.from(data));
    tempDragFiles.push(tempPath);
    return tempPath;
  });

  // Pre-create drag icon from app icon (avoids createFromBitmap issues on Windows)
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (fs.existsSync(iconPath)) {
    dragIcon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
  }

  // Drag-to-DAW: initiate OS-level file drag
  ipcMain.on('drag:start', (event, filePath: string) => {
    try {
      if (!dragIcon || dragIcon.isEmpty()) return;
      if (!fs.existsSync(filePath)) return;
      event.sender.startDrag({ file: filePath, icon: dragIcon });
    } catch {
      // Drag gesture may have ended or startDrag failed — ignore
    }
  });

  // Notify renderer of maximize state changes
  win.on('maximize', () => win.webContents.send('win:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized-changed', false));

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDatabase();
  registerFileSystemHandlers();
  registerDatabaseHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  closeDatabase();
  // Clean up temp drag files
  for (const f of tempDragFiles) {
    try { fs.unlinkSync(f); } catch { /* already deleted */ }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
