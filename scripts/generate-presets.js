/**
 * generate-presets.js
 *
 * Synthesizes 36 high-quality one-shot WAV files across 10 categories.
 * Output: presets/<category>/<name>.wav
 * Format: 44100 Hz, 24-bit, mono, no effects (dry).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(__dirname, '..', 'presets');
const SAMPLE_RATE = 44100;
const BIT_DEPTH = 24;
const CHANNELS = 1;

// ─── WAV writer ──────────────────────────────────────────────────────────────

function writeWav(filePath, samples) {
  // samples: Float64Array with values in [-1, 1]
  const numSamples = samples.length;
  const bytesPerSample = BIT_DEPTH / 8; // 3
  const dataSize = numSamples * CHANNELS * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(CHANNELS * bytesPerSample, 32); // block align
  buffer.writeUInt16LE(BIT_DEPTH, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const maxVal = (1 << (BIT_DEPTH - 1)) - 1; // 8388607
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    let intVal = Math.round(clamped * maxVal);
    // Write 24-bit little-endian (3 bytes)
    buffer[offset] = intVal & 0xff;
    buffer[offset + 1] = (intVal >> 8) & 0xff;
    buffer[offset + 2] = (intVal >> 16) & 0xff;
    offset += 3;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, buffer);
}

// ─── DSP helpers ─────────────────────────────────────────────────────────────

function generateSamples(durationSec) {
  return new Float64Array(Math.round(SAMPLE_RATE * durationSec));
}

function applyEnvelope(samples, attackMs, decayMs, sustainLevel, releaseMs) {
  const a = (attackMs / 1000) * SAMPLE_RATE;
  const d = (decayMs / 1000) * SAMPLE_RATE;
  const r = (releaseMs / 1000) * SAMPLE_RATE;
  const total = samples.length;
  const releaseStart = total - r;

  for (let i = 0; i < total; i++) {
    let env;
    if (i < a) {
      env = i / a;
    } else if (i < a + d) {
      env = 1 - ((1 - sustainLevel) * (i - a) / d);
    } else if (i < releaseStart) {
      env = sustainLevel;
    } else {
      env = sustainLevel * (1 - (i - releaseStart) / r);
    }
    samples[i] *= Math.max(0, env);
  }
  return samples;
}

function expDecay(samples, decayTimeSec) {
  const decayRate = 1 / (decayTimeSec * SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= Math.exp(-i * decayRate / 0.15);
  }
  return samples;
}

function noise() {
  return Math.random() * 2 - 1;
}

function softClip(x, amount) {
  return Math.tanh(x * amount) / Math.tanh(amount);
}

function normalize(samples, peak = 0.95) {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > max) max = abs;
  }
  if (max > 0) {
    const scale = peak / max;
    for (let i = 0; i < samples.length; i++) {
      samples[i] *= scale;
    }
  }
  return samples;
}

// Simple one-pole low-pass filter
function lowPass(samples, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = prev + alpha * (samples[i] - prev);
    samples[i] = prev;
  }
  return samples;
}

// Simple one-pole high-pass filter
function highPass(samples, cutoffHz) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    prevOut = alpha * (prevOut + x - prevIn);
    prevIn = x;
    samples[i] = prevOut;
  }
  return samples;
}

// Band-pass via low-pass then high-pass
function bandPass(samples, lowHz, highHz) {
  lowPass(samples, highHz);
  highPass(samples, lowHz);
  return samples;
}

// ─── Kick generators ─────────────────────────────────────────────────────────

function kickDeep() {
  const dur = 0.8;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Pitch sweep: 150Hz → 40Hz
    const freq = 40 + 110 * Math.exp(-t * 20);
    const phase = 2 * Math.PI * (40 * t + (110 / 20) * (1 - Math.exp(-t * 20)));
    s[i] = Math.sin(phase) * Math.exp(-t * 5);
  }
  return normalize(s);
}

function kickPunchy() {
  const dur = 0.5;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 55 + 180 * Math.exp(-t * 40);
    const phase = 2 * Math.PI * (55 * t + (180 / 40) * (1 - Math.exp(-t * 40)));
    s[i] = Math.sin(phase) * Math.exp(-t * 8);
    // Add transient click
    s[i] += noise() * Math.exp(-t * 200) * 0.3;
  }
  return normalize(lowPass(s, 8000));
}

function kickBoomy() {
  const dur = 1.0;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 35 + 80 * Math.exp(-t * 12);
    const phase = 2 * Math.PI * (35 * t + (80 / 12) * (1 - Math.exp(-t * 12)));
    s[i] = Math.sin(phase) * Math.exp(-t * 3);
    // Sub harmonic
    s[i] += Math.sin(2 * Math.PI * 30 * t) * 0.4 * Math.exp(-t * 4);
  }
  return normalize(lowPass(s, 5000));
}

function kickTight() {
  const dur = 0.3;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (70 * t + (250 / 60) * (1 - Math.exp(-t * 60)));
    s[i] = Math.sin(phase) * Math.exp(-t * 15);
    s[i] += noise() * Math.exp(-t * 300) * 0.2;
  }
  return normalize(lowPass(s, 10000));
}

function kickSub() {
  const dur = 1.2;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (30 * t + (60 / 8) * (1 - Math.exp(-t * 8)));
    s[i] = Math.sin(phase) * Math.exp(-t * 2.5);
  }
  return normalize(lowPass(s, 3000));
}

// ─── Snare generators ────────────────────────────────────────────────────────

function snareCrack() {
  const dur = 0.4;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Body: sine at ~180Hz
    const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 20);
    // Noise: snare wires
    const wires = noise() * Math.exp(-t * 12);
    // Transient
    const click = noise() * Math.exp(-t * 200) * 0.5;
    s[i] = body * 0.5 + wires * 0.6 + click;
  }
  return normalize(bandPass(s, 100, 12000));
}

function snareFat() {
  const dur = 0.5;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const body = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 12);
    const body2 = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 15) * 0.5;
    const wires = noise() * Math.exp(-t * 8);
    s[i] = body * 0.6 + body2 * 0.3 + wires * 0.5;
  }
  return normalize(bandPass(s, 80, 10000));
}

function snareRimshot() {
  const dur = 0.3;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // High metallic ping
    const ping = Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t * 30);
    const body = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 25);
    const click = noise() * Math.exp(-t * 400) * 0.8;
    s[i] = ping * 0.5 + body * 0.3 + click;
  }
  return normalize(bandPass(s, 150, 14000));
}

function snareThin() {
  const dur = 0.25;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const body = Math.sin(2 * Math.PI * 250 * t) * Math.exp(-t * 30);
    const wires = noise() * Math.exp(-t * 20) * 0.7;
    s[i] = body * 0.4 + wires * 0.6;
  }
  return normalize(highPass(s, 200));
}

function snareVintage() {
  const dur = 0.6;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const body = Math.sin(2 * Math.PI * 160 * t) * Math.exp(-t * 10);
    const wires = noise() * Math.exp(-t * 6) * 0.4;
    // Warm character
    const overtone = Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t * 14) * 0.2;
    s[i] = body * 0.6 + overtone + wires;
  }
  return normalize(lowPass(bandPass(s, 80, 8000), 6000));
}

// ─── Hi-Hat generators ───────────────────────────────────────────────────────

function hatClosedTight() {
  const dur = 0.1;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Metallic partials
    const metal = Math.sin(2 * Math.PI * 4200 * t) * 0.3
      + Math.sin(2 * Math.PI * 6800 * t) * 0.3
      + Math.sin(2 * Math.PI * 9500 * t) * 0.2;
    const n = noise() * 0.5;
    s[i] = (metal + n) * Math.exp(-t * 60);
  }
  return normalize(highPass(s, 3000));
}

function hatOpenSizzle() {
  const dur = 0.8;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const metal = Math.sin(2 * Math.PI * 4000 * t) * 0.3
      + Math.sin(2 * Math.PI * 6500 * t) * 0.25
      + Math.sin(2 * Math.PI * 8500 * t) * 0.2
      + Math.sin(2 * Math.PI * 11000 * t) * 0.15;
    const n = noise() * 0.4;
    s[i] = (metal + n) * Math.exp(-t * 4);
  }
  return normalize(highPass(s, 2500));
}

function hatPedal() {
  const dur = 0.15;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const metal = Math.sin(2 * Math.PI * 3800 * t) * 0.3
      + Math.sin(2 * Math.PI * 5500 * t) * 0.2;
    const n = noise() * 0.4;
    s[i] = (metal + n) * Math.exp(-t * 35);
  }
  return normalize(highPass(s, 2000));
}

function hatCrispy() {
  const dur = 0.12;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const metal = Math.sin(2 * Math.PI * 5000 * t) * 0.2
      + Math.sin(2 * Math.PI * 8000 * t) * 0.3
      + Math.sin(2 * Math.PI * 12000 * t) * 0.3;
    const n = noise() * 0.5;
    s[i] = (metal + n) * Math.exp(-t * 50);
  }
  return normalize(highPass(s, 4000));
}

// ─── Clap generators ─────────────────────────────────────────────────────────

function clapLayered() {
  const dur = 0.4;
  const s = generateSamples(dur);
  // Multiple micro-hits for layered feel
  const offsets = [0, 0.012, 0.025, 0.04];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (const off of offsets) {
      const dt = t - off;
      if (dt >= 0) {
        s[i] += noise() * Math.exp(-dt * 18) * 0.4;
      }
    }
    // Tail
    s[i] += noise() * Math.exp(-t * 10) * 0.15;
  }
  return normalize(bandPass(s, 500, 10000));
}

function clapTight() {
  const dur = 0.2;
  const s = generateSamples(dur);
  const offsets = [0, 0.008, 0.015];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (const off of offsets) {
      const dt = t - off;
      if (dt >= 0) {
        s[i] += noise() * Math.exp(-dt * 40) * 0.5;
      }
    }
  }
  return normalize(bandPass(s, 600, 12000));
}

function clapWide() {
  const dur = 0.5;
  const s = generateSamples(dur);
  const offsets = [0, 0.015, 0.03, 0.05, 0.07];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (const off of offsets) {
      const dt = t - off;
      if (dt >= 0) {
        s[i] += noise() * Math.exp(-dt * 12) * 0.35;
      }
    }
    s[i] += noise() * Math.exp(-t * 6) * 0.1;
  }
  return normalize(bandPass(s, 400, 9000));
}

// ─── Tom generators ──────────────────────────────────────────────────────────

function tomLow() {
  const dur = 0.7;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 80 + 40 * Math.exp(-t * 15);
    const phase = 2 * Math.PI * (80 * t + (40 / 15) * (1 - Math.exp(-t * 15)));
    s[i] = Math.sin(phase) * Math.exp(-t * 5);
    s[i] += noise() * Math.exp(-t * 80) * 0.15;
  }
  return normalize(lowPass(s, 6000));
}

function tomMid() {
  const dur = 0.6;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 150 + 60 * Math.exp(-t * 18);
    const phase = 2 * Math.PI * (150 * t + (60 / 18) * (1 - Math.exp(-t * 18)));
    s[i] = Math.sin(phase) * Math.exp(-t * 6);
    s[i] += noise() * Math.exp(-t * 100) * 0.12;
  }
  return normalize(lowPass(s, 7000));
}

function tomHigh() {
  const dur = 0.5;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (250 * t + (100 / 25) * (1 - Math.exp(-t * 25)));
    s[i] = Math.sin(phase) * Math.exp(-t * 8);
    s[i] += noise() * Math.exp(-t * 120) * 0.1;
  }
  return normalize(lowPass(s, 8000));
}

function tomFloor() {
  const dur = 0.9;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (65 * t + (30 / 10) * (1 - Math.exp(-t * 10)));
    s[i] = Math.sin(phase) * Math.exp(-t * 3.5);
    s[i] += Math.sin(2 * Math.PI * 130 * t) * 0.2 * Math.exp(-t * 6);
    s[i] += noise() * Math.exp(-t * 60) * 0.12;
  }
  return normalize(lowPass(s, 5000));
}

// ─── 808 generators ──────────────────────────────────────────────────────────

function e808Long() {
  const dur = 3.0;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 40 + 30 * Math.exp(-t * 10);
    const phase = 2 * Math.PI * (40 * t + (30 / 10) * (1 - Math.exp(-t * 10)));
    s[i] = Math.sin(phase) * Math.exp(-t * 1.0);
    // Subtle harmonics
    s[i] += Math.sin(phase * 2) * 0.1 * Math.exp(-t * 1.5);
  }
  return normalize(lowPass(s, 4000));
}

function e808Short() {
  const dur = 0.8;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (50 * t + (60 / 15) * (1 - Math.exp(-t * 15)));
    s[i] = Math.sin(phase) * Math.exp(-t * 4);
  }
  return normalize(lowPass(s, 3000));
}

function e808Distorted() {
  const dur = 2.0;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (42 * t + (40 / 12) * (1 - Math.exp(-t * 12)));
    let val = Math.sin(phase) * Math.exp(-t * 1.2);
    val = softClip(val * 3, 2.5);
    s[i] = val;
  }
  return normalize(lowPass(s, 6000));
}

function e808Clean() {
  const dur = 2.5;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const phase = 2 * Math.PI * (45 * t + (25 / 8) * (1 - Math.exp(-t * 8)));
    s[i] = Math.sin(phase) * Math.exp(-t * 1.0);
  }
  return normalize(lowPass(s, 2500));
}

function e808Slide() {
  const dur = 2.5;
  const s = generateSamples(dur);
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Pitch slides up then stabilizes
    const freq = 38 + 15 * Math.sin(t * 3) * Math.exp(-t * 1.5);
    const phase = 2 * Math.PI * freq * t;
    s[i] = Math.sin(phase) * Math.exp(-t * 0.9);
  }
  return normalize(lowPass(s, 3500));
}

// ─── Piano generators ────────────────────────────────────────────────────────

function pianoBright() {
  const dur = 2.5;
  const s = generateSamples(dur);
  const fundamental = 440; // A4
  const harmonics = [1, 2, 3, 4, 5, 6, 7];
  const amps = [1, 0.5, 0.3, 0.2, 0.15, 0.1, 0.05];
  const decays = [3, 4, 5, 6, 7, 8, 10];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (let h = 0; h < harmonics.length; h++) {
      s[i] += Math.sin(2 * Math.PI * fundamental * harmonics[h] * t)
        * amps[h] * Math.exp(-t * decays[h]);
    }
    // Hammer strike
    s[i] += noise() * Math.exp(-t * 300) * 0.15;
  }
  return normalize(lowPass(s, 12000));
}

function pianoWarm() {
  const dur = 3.0;
  const s = generateSamples(dur);
  const fundamental = 262; // C4
  const harmonics = [1, 2, 3, 4, 5];
  const amps = [1, 0.4, 0.15, 0.08, 0.03];
  const decays = [2.5, 3.5, 5, 6, 8];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (let h = 0; h < harmonics.length; h++) {
      s[i] += Math.sin(2 * Math.PI * fundamental * harmonics[h] * t)
        * amps[h] * Math.exp(-t * decays[h]);
    }
    s[i] += noise() * Math.exp(-t * 400) * 0.08;
  }
  return normalize(lowPass(s, 6000));
}

function pianoLoFi() {
  const dur = 2.0;
  const s = generateSamples(dur);
  const fundamental = 330; // E4
  const harmonics = [1, 2, 3, 4];
  const amps = [1, 0.35, 0.12, 0.05];
  const decays = [3, 4, 6, 8];
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (let h = 0; h < harmonics.length; h++) {
      s[i] += Math.sin(2 * Math.PI * fundamental * harmonics[h] * t)
        * amps[h] * Math.exp(-t * decays[h]);
    }
    // Add lo-fi character: bit reduction simulation
    s[i] += noise() * 0.02;
  }
  // Heavy low-pass for lo-fi warmth
  return normalize(lowPass(s, 3500));
}

// ─── Flute generators ────────────────────────────────────────────────────────

function fluteAiry() {
  const dur = 2.0;
  const s = generateSamples(dur);
  const fundamental = 587; // D5
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Vibrato
    const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * t);
    const freq = fundamental * vibrato;
    // Mostly fundamental with subtle 2nd harmonic
    s[i] = Math.sin(2 * Math.PI * freq * t) * 0.8
      + Math.sin(2 * Math.PI * freq * 2 * t) * 0.1;
    // Breath noise
    s[i] += noise() * 0.08;
  }
  applyEnvelope(s, 80, 100, 0.7, 200);
  return normalize(lowPass(s, 8000));
}

function fluteBreathy() {
  const dur = 2.5;
  const s = generateSamples(dur);
  const fundamental = 523; // C5
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
    const freq = fundamental * vibrato;
    s[i] = Math.sin(2 * Math.PI * freq * t) * 0.6
      + Math.sin(2 * Math.PI * freq * 2 * t) * 0.08;
    // More breath noise
    s[i] += noise() * 0.18;
  }
  applyEnvelope(s, 120, 150, 0.6, 300);
  return normalize(lowPass(s, 7000));
}

// ─── Strings generators ──────────────────────────────────────────────────────

function stringsLush() {
  const dur = 3.5;
  const s = generateSamples(dur);
  const fundamental = 220; // A3
  // Sawtooth approximation (bowed string)
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5.5 * t);
    const freq = fundamental * vibrato;
    for (let h = 1; h <= 12; h++) {
      s[i] += (Math.pow(-1, h + 1) / h) * Math.sin(2 * Math.PI * freq * h * t)
        * Math.exp(-t * (0.3 + h * 0.1));
    }
  }
  applyEnvelope(s, 200, 300, 0.8, 500);
  return normalize(lowPass(s, 8000));
}

function stringsPizzicato() {
  const dur = 1.0;
  const s = generateSamples(dur);
  const fundamental = 293; // D4
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (let h = 1; h <= 8; h++) {
      s[i] += (1 / h) * Math.sin(2 * Math.PI * fundamental * h * t)
        * Math.exp(-t * (4 + h * 2));
    }
    // Pluck transient
    s[i] += noise() * Math.exp(-t * 200) * 0.2;
  }
  return normalize(lowPass(s, 9000));
}

function stringsDark() {
  const dur = 4.0;
  const s = generateSamples(dur);
  const fundamental = 147; // D3
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const vibrato = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
    const freq = fundamental * vibrato;
    for (let h = 1; h <= 8; h++) {
      s[i] += (Math.pow(-1, h + 1) / h) * Math.sin(2 * Math.PI * freq * h * t)
        * Math.exp(-t * (0.2 + h * 0.15));
    }
  }
  applyEnvelope(s, 300, 400, 0.75, 600);
  return normalize(lowPass(s, 4000));
}

// ─── Brass generators ────────────────────────────────────────────────────────

function brassStab() {
  const dur = 0.5;
  const s = generateSamples(dur);
  const fundamental = 349; // F4
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    // Square-ish wave (odd harmonics dominant)
    for (let h = 1; h <= 9; h += 2) {
      s[i] += (1 / h) * Math.sin(2 * Math.PI * fundamental * h * t);
    }
    // Even harmonics for brass character
    for (let h = 2; h <= 6; h += 2) {
      s[i] += (0.3 / h) * Math.sin(2 * Math.PI * fundamental * h * t);
    }
  }
  applyEnvelope(s, 10, 50, 0.6, 150);
  return normalize(lowPass(s, 8000));
}

function brassMuted() {
  const dur = 0.8;
  const s = generateSamples(dur);
  const fundamental = 311; // Eb4
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    for (let h = 1; h <= 7; h += 2) {
      s[i] += (1 / h) * Math.sin(2 * Math.PI * fundamental * h * t);
    }
    for (let h = 2; h <= 4; h += 2) {
      s[i] += (0.2 / h) * Math.sin(2 * Math.PI * fundamental * h * t);
    }
  }
  applyEnvelope(s, 20, 80, 0.5, 200);
  // Heavy low-pass for muted character
  return normalize(lowPass(s, 3000));
}

function brassFull() {
  const dur = 2.0;
  const s = generateSamples(dur);
  const fundamental = 370; // F#4
  for (let i = 0; i < s.length; i++) {
    const t = i / SAMPLE_RATE;
    const vibrato = 1 + 0.002 * Math.sin(2 * Math.PI * 5 * t);
    const freq = fundamental * vibrato;
    for (let h = 1; h <= 11; h++) {
      const amp = h % 2 === 1 ? (1 / h) : (0.4 / h);
      s[i] += amp * Math.sin(2 * Math.PI * freq * h * t);
    }
  }
  applyEnvelope(s, 40, 100, 0.75, 300);
  return normalize(lowPass(s, 10000));
}

// ─── Preset manifest ─────────────────────────────────────────────────────────

const PRESETS = [
  // Kicks
  { name: 'kick-deep', category: 'kicks', generator: kickDeep },
  { name: 'kick-punchy', category: 'kicks', generator: kickPunchy },
  { name: 'kick-boomy', category: 'kicks', generator: kickBoomy },
  { name: 'kick-tight', category: 'kicks', generator: kickTight },
  { name: 'kick-sub', category: 'kicks', generator: kickSub },
  // Snares
  { name: 'snare-crack', category: 'snares', generator: snareCrack },
  { name: 'snare-fat', category: 'snares', generator: snareFat },
  { name: 'snare-rimshot', category: 'snares', generator: snareRimshot },
  { name: 'snare-thin', category: 'snares', generator: snareThin },
  { name: 'snare-vintage', category: 'snares', generator: snareVintage },
  // Hi-Hats
  { name: 'hat-closed-tight', category: 'hi-hats', generator: hatClosedTight },
  { name: 'hat-open-sizzle', category: 'hi-hats', generator: hatOpenSizzle },
  { name: 'hat-pedal', category: 'hi-hats', generator: hatPedal },
  { name: 'hat-crispy', category: 'hi-hats', generator: hatCrispy },
  // Claps
  { name: 'clap-layered', category: 'claps', generator: clapLayered },
  { name: 'clap-tight', category: 'claps', generator: clapTight },
  { name: 'clap-wide', category: 'claps', generator: clapWide },
  // Toms
  { name: 'tom-low', category: 'toms', generator: tomLow },
  { name: 'tom-mid', category: 'toms', generator: tomMid },
  { name: 'tom-high', category: 'toms', generator: tomHigh },
  { name: 'tom-floor', category: 'toms', generator: tomFloor },
  // 808s
  { name: '808-long', category: '808s', generator: e808Long },
  { name: '808-short', category: '808s', generator: e808Short },
  { name: '808-distorted', category: '808s', generator: e808Distorted },
  { name: '808-clean', category: '808s', generator: e808Clean },
  { name: '808-slide', category: '808s', generator: e808Slide },
  // Piano
  { name: 'piano-bright', category: 'piano', generator: pianoBright },
  { name: 'piano-warm', category: 'piano', generator: pianoWarm },
  { name: 'piano-lofi', category: 'piano', generator: pianoLoFi },
  // Flute
  { name: 'flute-airy', category: 'flute', generator: fluteAiry },
  { name: 'flute-breathy', category: 'flute', generator: fluteBreathy },
  // Strings
  { name: 'strings-lush', category: 'strings', generator: stringsLush },
  { name: 'strings-pizzicato', category: 'strings', generator: stringsPizzicato },
  { name: 'strings-dark', category: 'strings', generator: stringsDark },
  // Brass
  { name: 'brass-stab', category: 'brass', generator: brassStab },
  { name: 'brass-muted', category: 'brass', generator: brassMuted },
  { name: 'brass-full', category: 'brass', generator: brassFull },
];

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`Generating ${PRESETS.length} preset WAV files...`);
console.log(`Format: ${SAMPLE_RATE} Hz, ${BIT_DEPTH}-bit, mono`);
console.log(`Output: ${PRESETS_DIR}\n`);

for (const preset of PRESETS) {
  const filePath = join(PRESETS_DIR, preset.category, `${preset.name}.wav`);
  const samples = preset.generator();
  writeWav(filePath, samples);

  const fileSize = Math.round(samples.length * 3 / 1024);
  const duration = (samples.length / SAMPLE_RATE).toFixed(2);
  console.log(`  ✓ ${preset.category}/${preset.name}.wav  (${duration}s, ${fileSize} KB)`);
}

console.log(`\nDone! Generated ${PRESETS.length} files across ${new Set(PRESETS.map(p => p.category)).size} categories.`);
