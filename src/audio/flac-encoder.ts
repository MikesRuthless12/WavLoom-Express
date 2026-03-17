/**
 * Encode an AudioBuffer as a FLAC ArrayBuffer.
 * Delegates to the main process (Node.js) where libflacjs runs natively.
 */
export async function audioBufferToFlacArrayBuffer(
  buffer: AudioBuffer,
  bitDepth: 16 | 24 = 16,
): Promise<ArrayBuffer> {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  // Build interleaved Int32 samples (FLAC expects 32-bit wide samples regardless of bit depth)
  const interleaved = new Int32Array(length * numChannels);
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      if (bitDepth === 16) {
        interleaved[i * numChannels + ch] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
      } else {
        interleaved[i * numChannels + ch] = Math.round(
          sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF,
        );
      }
    }
  }

  // Send to main process for FLAC encoding
  const result = await window.electronAPI.encodeFlac(
    interleaved.buffer,
    sampleRate,
    numChannels,
    bitDepth,
    length,
  );

  return result;
}
