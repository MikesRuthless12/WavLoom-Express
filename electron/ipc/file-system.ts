import { ipcMain, dialog, app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const createFlac = require('libflacjs') as (variant?: string) => FlacInstance;

// Minimal type for the libflacjs instance methods we use
interface FlacInstance {
  isReady(): boolean;
  on(event: string, listener: (evt: unknown) => void): void;
  create_libflac_encoder(sampleRate: number, channels: number, bps: number, compressionLevel: number, totalSamples: number, verify: boolean): number;
  init_encoder_stream(encoder: number, writeCb: (buffer: Uint8Array, bytes: number, samples: number, currentFrame: number) => void, metaCb: (data: unknown) => void, ogg: boolean, client: number): number;
  FLAC__stream_encoder_process_interleaved(encoder: number, buffer: Int32Array, samples: number): boolean;
  FLAC__stream_encoder_finish(encoder: number): boolean;
  FLAC__stream_encoder_delete(encoder: number): void;
  FLAC__stream_encoder_get_state(encoder: number): number;
}

// Initialize libflacjs once and cache a ready-promise
let flacReadyPromise: Promise<FlacInstance> | null = null;

function getFlac(): Promise<FlacInstance> {
  if (!flacReadyPromise) {
    flacReadyPromise = new Promise<FlacInstance>((resolve) => {
      const instance = createFlac();
      if (instance.isReady()) {
        resolve(instance);
      } else {
        instance.on('ready', () => resolve(instance));
      }
    });
  }
  return flacReadyPromise;
}

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac'];

export function registerFileSystemHandlers(): void {
  ipcMain.handle('fs:openFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
      isAudio: AUDIO_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()),
    }));
  });

  ipcMain.handle('fs:readAudioFile', async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error('FILE_NOT_FOUND');
    }
    const stats = fs.statSync(filePath);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }
    if (stats.size === 0) {
      throw new Error('FILE_EMPTY');
    }
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
  });

  ipcMain.handle(
    'fs:writeAudioFile',
    async (_event, filePath: string, data: ArrayBuffer) => {
      try {
        fs.writeFileSync(filePath, Buffer.from(data));
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOSPC') {
          throw new Error('DISK_FULL');
        }
        if (code === 'EACCES' || code === 'EPERM') {
          throw new Error('WRITE_DENIED');
        }
        throw err;
      }
    },
  );

  ipcMain.handle('fs:createDirectory', async (_event, dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
  });

  ipcMain.handle('fs:getDefaultExportDir', async () => {
    const dir = path.join(app.getPath('documents'), 'WavLoom Express', 'Exports');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  });

  ipcMain.handle(
    'fs:showSaveDialog',
    async (_event, defaultName: string, format: string) => {
      let filters: Electron.FileFilter[];
      switch (format) {
        case 'flac':
          filters = [{ name: 'FLAC Audio', extensions: ['flac'] }];
          break;
        case 'aiff':
          filters = [{ name: 'AIFF Audio', extensions: ['aiff', 'aif'] }];
          break;
        case 'mp3':
          filters = [{ name: 'MP3 Audio', extensions: ['mp3'] }];
          break;
        default:
          filters = [{ name: 'WAV Audio', extensions: ['wav'] }];
      }

      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters,
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
  );

  ipcMain.handle('fs:openPresetFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'WavLoom Preset', extensions: ['wlepreset'] },
      ],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('fs:readPresetFile', async (_event, filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  });

  ipcMain.handle(
    'fs:savePresetFile',
    async (_event, defaultName: string) => {
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'WavLoom Preset', extensions: ['wlepreset'] }],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      });
      if (result.canceled || !result.filePath) return null;
      return result.filePath;
    },
  );

  ipcMain.handle(
    'fs:writePresetFile',
    async (_event, filePath: string, content: string) => {
      fs.writeFileSync(filePath, content, 'utf-8');
    },
  );

  // FLAC encoding via libflacjs (runs in main process)
  ipcMain.handle(
    'fs:encodeFlac',
    async (
      _event,
      pcmData: ArrayBuffer,
      sampleRate: number,
      channels: number,
      bitsPerSample: number,
      totalSamples: number,
    ): Promise<ArrayBuffer> => {
      const Flac = await getFlac();

      const flacChunks: Uint8Array[] = [];
      const state: { meta: { min_framesize: number; max_framesize: number; total_samples: number; md5sum: string } | null } = { meta: null };

      const writeCallback = (buffer: Uint8Array) => {
        flacChunks.push(new Uint8Array(buffer));
      };

      const metadataCallback = (metadata: unknown) => {
        const m = metadata as Record<string, unknown>;
        if (m) {
          state.meta = {
            min_framesize: m.min_framesize as number,
            max_framesize: m.max_framesize as number,
            total_samples: m.total_samples as number,
            md5sum: m.md5sum as string,
          };
        }
      };

      const encoder = Flac.create_libflac_encoder(
        sampleRate,
        channels,
        bitsPerSample,
        5, // compression level (0-8, 5 is a good balance)
        totalSamples,
        false, // verify
      );

      if (encoder === 0) {
        throw new Error('Failed to create FLAC encoder');
      }

      const initStatus = Flac.init_encoder_stream(
        encoder,
        writeCallback,
        metadataCallback,
        false, // not OGG
        0,
      );

      if (initStatus !== 0) {
        Flac.FLAC__stream_encoder_delete(encoder);
        throw new Error(`FLAC encoder init failed with status ${initStatus}`);
      }

      const samples = new Int32Array(pcmData);
      const ok = Flac.FLAC__stream_encoder_process_interleaved(
        encoder,
        samples,
        totalSamples,
      );

      if (!ok) {
        const state = Flac.FLAC__stream_encoder_get_state(encoder);
        Flac.FLAC__stream_encoder_delete(encoder);
        throw new Error(`FLAC encoding failed with state ${state}`);
      }

      Flac.FLAC__stream_encoder_finish(encoder);
      Flac.FLAC__stream_encoder_delete(encoder);

      // Patch STREAMINFO metadata block with final values from the encoder.
      // The STREAMINFO block sits right after the "fLaC" marker (byte 4).
      // Block header is 4 bytes, then STREAMINFO data starts at byte 8.
      // Layout of STREAMINFO data (34 bytes):
      //   0-1:   min_blocksize
      //   2-3:   max_blocksize
      //   4-6:   min_framesize   (24 bits)
      //   7-9:   max_framesize   (24 bits)
      //  10-17:  sample_rate(20) | channels(3) | bps(5) | total_samples(36)
      //  18-33:  md5sum          (128 bits)
      if (state.meta && flacChunks.length > 0) {
        // Find the chunk containing the STREAMINFO (first chunk has "fLaC" header)
        const headerChunk = flacChunks[0];
        // Verify "fLaC" marker
        if (headerChunk.length >= 4 &&
            headerChunk[0] === 0x66 && headerChunk[1] === 0x4C &&
            headerChunk[2] === 0x61 && headerChunk[3] === 0x43) {
          // STREAMINFO data starts at offset 8 (4 marker + 4 block header)
          // If the first chunk is only the marker, the STREAMINFO is in the next chunk
          let siData: Uint8Array;
          let siOffset: number;
          if (headerChunk.length > 8) {
            siData = headerChunk;
            siOffset = 8;
          } else if (flacChunks.length > 1 && flacChunks[1].length >= 34) {
            siData = flacChunks[1];
            siOffset = 4; // skip block header in second chunk
          } else {
            siData = headerChunk;
            siOffset = 8;
          }

          if (siData.length >= siOffset + 34 && state.meta) {
            const view = new DataView(siData.buffer, siData.byteOffset, siData.byteLength);

            // Patch min_framesize (3 bytes big-endian at siOffset+4)
            view.setUint8(siOffset + 4, (state.meta.min_framesize >> 16) & 0xFF);
            view.setUint8(siOffset + 5, (state.meta.min_framesize >> 8) & 0xFF);
            view.setUint8(siOffset + 6, state.meta.min_framesize & 0xFF);

            // Patch max_framesize (3 bytes big-endian at siOffset+7)
            view.setUint8(siOffset + 7, (state.meta.max_framesize >> 16) & 0xFF);
            view.setUint8(siOffset + 8, (state.meta.max_framesize >> 8) & 0xFF);
            view.setUint8(siOffset + 9, state.meta.max_framesize & 0xFF);

            // Patch total_samples (36-bit field)
            // Byte at siOffset+13 has: bps_low(4 bits) | total_samples_high(4 bits)
            // We only touch the lower 4 bits (total_samples high nibble)
            // total_samples is 36 bits. JS bitwise >> only works on 32-bit ints,
            // so use Math.floor for the high 4 bits.
            const tsHigh4 = Math.floor(state.meta.total_samples / 4294967296) & 0x0F;
            const existingByte13 = view.getUint8(siOffset + 13);
            view.setUint8(siOffset + 13, (existingByte13 & 0xF0) | tsHigh4);
            view.setUint8(siOffset + 14, (state.meta.total_samples >>> 24) & 0xFF);
            view.setUint8(siOffset + 15, (state.meta.total_samples >>> 16) & 0xFF);
            view.setUint8(siOffset + 16, (state.meta.total_samples >>> 8) & 0xFF);
            view.setUint8(siOffset + 17, state.meta.total_samples & 0xFF);

            // Patch md5sum (16 bytes at siOffset+18)
            if (state.meta.md5sum) {
              for (let i = 0; i < 16; i++) {
                const hex = state.meta.md5sum.substring(i * 2, i * 2 + 2);
                view.setUint8(siOffset + 18 + i, parseInt(hex, 16));
              }
            }
          }
        }
      }

      // Concatenate chunks
      const totalLength = flacChunks.reduce((sum, c) => sum + c.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of flacChunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      return result.buffer;
    },
  );
}
