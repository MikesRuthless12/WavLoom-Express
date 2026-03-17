import { Mp3Encoder } from '@breezystack/lamejs';
import { AudioEngine } from './engine';
import { audioBufferToWavArrayBuffer } from './wav-encoder';
import { audioBufferToAiffArrayBuffer } from './aiff-encoder';
import { audioBufferToFlacArrayBuffer } from './flac-encoder';

export type ExportFormat = 'wav' | 'mp3' | 'flac' | 'aiff';
export type WavBitDepth = 16 | 24 | 32;
export type FlacBitDepth = 16 | 24;
export type AiffBitDepth = 16 | 24;
export type Mp3Bitrate = 128 | 192 | 256 | 320;

export interface ExportOptions {
  format: ExportFormat;
  filePath: string;
  wavBitDepth?: WavBitDepth;
  mp3Bitrate?: Mp3Bitrate;
  flacBitDepth?: FlacBitDepth;
  aiffBitDepth?: AiffBitDepth;
}

export interface ExportResult {
  filePath: string;
}

export async function exportAudio(options: ExportOptions): Promise<ExportResult> {
  const { format, filePath, wavBitDepth = 16, mp3Bitrate = 320, flacBitDepth = 16, aiffBitDepth = 16 } = options;
  const engine = AudioEngine.getInstance();
  const processed = await engine.renderProcessed();
  if (!processed) throw new Error('No audio to export');

  let data: ArrayBuffer;

  if (format === 'wav') {
    data = audioBufferToWavArrayBuffer(processed, wavBitDepth);
  } else if (format === 'flac') {
    data = await audioBufferToFlacArrayBuffer(processed, flacBitDepth);
  } else if (format === 'aiff') {
    data = audioBufferToAiffArrayBuffer(processed, aiffBitDepth);
  } else {
    data = encodeMp3(processed, mp3Bitrate);
  }

  try {
    await window.electronAPI.writeAudioFile(filePath, data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('DISK_FULL')) {
      throw new Error('Export failed. Check disk space.');
    }
    if (msg.includes('WRITE_DENIED')) {
      throw new Error("Can't write here. Choose another location.");
    }
    throw new Error('Export failed.');
  }
  return { filePath };
}

function encodeMp3(buffer: AudioBuffer, bitrate: Mp3Bitrate): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, bitrate);

  const blockSize = 1152;
  const mp3Chunks: Uint8Array[] = [];

  const leftF32 = buffer.getChannelData(0);
  const rightF32 = numChannels > 1 ? buffer.getChannelData(1) : leftF32;

  for (let i = 0; i < leftF32.length; i += blockSize) {
    const end = Math.min(i + blockSize, leftF32.length);
    const leftBlock = floatToInt16(leftF32, i, end);
    const rightBlock = floatToInt16(rightF32, i, end);

    const chunk = numChannels > 1
      ? encoder.encodeBuffer(leftBlock, rightBlock)
      : encoder.encodeBuffer(leftBlock);

    if (chunk.length > 0) mp3Chunks.push(chunk);
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Chunks.push(flushed);

  // Concatenate all chunks
  const totalLength = mp3Chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    result.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
    offset += chunk.length;
  }

  return result.buffer;
}

function floatToInt16(float32: Float32Array, start: number, end: number): Int16Array {
  const length = end - start;
  const int16 = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, float32[start + i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

/**
 * Export the current processed audio to a temp WAV file for drag-to-DAW.
 * Returns the temp file path.
 */
export async function exportToTempWav(fileName: string): Promise<string> {
  const engine = AudioEngine.getInstance();
  const processed = await engine.renderProcessed();
  if (!processed) throw new Error('No audio to export');
  const data = audioBufferToWavArrayBuffer(processed, 16);
  return window.electronAPI.exportToTemp(data, fileName);
}

export interface KitSlotExportOptions {
  format: ExportFormat;
  wavBitDepth?: WavBitDepth;
  mp3Bitrate?: Mp3Bitrate;
  flacBitDepth?: FlacBitDepth;
  aiffBitDepth?: AiffBitDepth;
}

/**
 * Export a single kit slot audio file.
 * Reads the source file, decodes it, and writes to the output path in the chosen format.
 */
export async function exportKitSlot(
  sourcePath: string,
  outputPath: string,
  options: KitSlotExportOptions = { format: 'wav', wavBitDepth: 16 },
): Promise<void> {
  const { format, wavBitDepth = 16, mp3Bitrate = 320, flacBitDepth = 16, aiffBitDepth = 16 } = options;
  const arrayBuffer = await window.electronAPI.readAudioFile(sourcePath);
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    let data: ArrayBuffer;
    if (format === 'wav') {
      data = audioBufferToWavArrayBuffer(decoded, wavBitDepth);
    } else if (format === 'flac') {
      data = await audioBufferToFlacArrayBuffer(decoded, flacBitDepth);
    } else if (format === 'aiff') {
      data = audioBufferToAiffArrayBuffer(decoded, aiffBitDepth);
    } else {
      data = encodeMp3(decoded, mp3Bitrate);
    }
    await window.electronAPI.writeAudioFile(outputPath, data);
  } finally {
    await audioCtx.close();
  }
}
