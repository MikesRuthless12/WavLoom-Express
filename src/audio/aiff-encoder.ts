/**
 * Encode an AudioBuffer as an AIFF-C (AIFC) ArrayBuffer with 'NONE' compression.
 *
 * AIFF-C is the modern variant of AIFF used by Logic Pro, Pro Tools, and Ableton.
 * It is identical to classic AIFF for uncompressed PCM but includes an explicit
 * compression type in the COMM chunk, which modern DAWs expect.
 * All sample data is big-endian.
 */
export function audioBufferToAiffArrayBuffer(buffer: AudioBuffer, bitDepth: 16 | 24 = 16): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const soundDataSize = numFrames * blockAlign;

  // AIFF-C COMM chunk data:
  //   numChannels (2) + numSampleFrames (4) + sampleSize (2) +
  //   sampleRate (10) + compressionType (4) + compressionName pascal string (16)
  // compressionName = "\x0Enot compressed\x00" (14 chars + length byte + pad = 16)
  const commDataSize = 2 + 4 + 2 + 10 + 4 + 16; // 38

  // FVER chunk (required for AIFC): 4-byte version timestamp
  const fverChunkSize = 12; // ID(4) + size(4) + version(4)

  // SSND chunk: ID(4) + size(4) + offset(4) + blockSize(4) + soundData
  const ssndChunkSize = 4 + 4 + 4 + 4 + soundDataSize;

  // FORM header: ID(4) + size(4) + type(4)
  const totalSize = 12 + fverChunkSize + (8 + commDataSize) + ssndChunkSize;

  const ab = new ArrayBuffer(totalSize);
  const view = new DataView(ab);
  let pos = 0;

  // ---- FORM header ----
  setStr(view, pos, 'FORM');       pos += 4;
  view.setUint32(pos, totalSize - 8, false); pos += 4;
  setStr(view, pos, 'AIFC');       pos += 4;

  // ---- FVER chunk (required for AIFF-C) ----
  setStr(view, pos, 'FVER');       pos += 4;
  view.setUint32(pos, 4, false);   pos += 4;  // chunk data size
  view.setUint32(pos, 0xA2805140, false); pos += 4; // AIFF-C version 1 timestamp

  // ---- COMM chunk ----
  setStr(view, pos, 'COMM');       pos += 4;
  view.setUint32(pos, commDataSize, false); pos += 4;
  view.setInt16(pos, numChannels, false);   pos += 2;
  view.setUint32(pos, numFrames, false);    pos += 4;  // numSampleFrames
  view.setInt16(pos, bitDepth, false);      pos += 2;  // sampleSize
  writeIeee80(view, pos, sampleRate);       pos += 10;
  setStr(view, pos, 'NONE');               pos += 4;  // compressionType
  // compressionName as Pascal string: length byte + "not compressed" (14 chars) + pad byte
  view.setUint8(pos, 14);                  pos += 1;  // Pascal string length
  setStr(view, pos, 'not compressed');     pos += 14;
  view.setUint8(pos, 0);                  pos += 1;  // pad to even

  // ---- SSND chunk ----
  setStr(view, pos, 'SSND');       pos += 4;
  view.setUint32(pos, 8 + soundDataSize, false); pos += 4;
  view.setUint32(pos, 0, false);   pos += 4;  // offset
  view.setUint32(pos, 0, false);   pos += 4;  // blockSize

  // ---- Interleaved sample data (big-endian) ----
  const chData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    chData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, chData[ch][i]));
      if (bitDepth === 16) {
        const v = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF);
        view.setInt16(pos, v, false);
      } else {
        const v = s < 0
          ? Math.round(s * 0x800000)
          : Math.round(s * 0x7FFFFF);
        view.setUint8(pos,     (v >> 16) & 0xFF);
        view.setUint8(pos + 1, (v >> 8)  & 0xFF);
        view.setUint8(pos + 2,  v        & 0xFF);
      }
      pos += bytesPerSample;
    }
  }

  return ab;
}

// ---- helpers ----

function setStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Write an IEEE 754 80-bit extended-precision float (big-endian).
 * Uses integer arithmetic only — exact for all standard sample rates.
 */
function writeIeee80(view: DataView, offset: number, value: number): void {
  if (value === 0) {
    for (let i = 0; i < 10; i++) view.setUint8(offset + i, 0);
    return;
  }

  let exp = 0;
  let v = Math.floor(value);
  let tmp = v;
  while (tmp >= 2) { tmp = Math.floor(tmp / 2); exp++; }

  const shift = 31 - exp;
  let hi: number;
  let lo = 0;
  if (shift >= 0) {
    hi = (v << shift) >>> 0;
  } else {
    hi = (v >>> (-shift)) >>> 0;
    lo = ((v << (32 + shift)) >>> 0);
  }

  const biasedExp = exp + 16383;
  view.setUint16(offset,     biasedExp & 0x7FFF, false);
  view.setUint32(offset + 2, hi, false);
  view.setUint32(offset + 6, lo, false);
}
