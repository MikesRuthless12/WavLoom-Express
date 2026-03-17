/**
 * Audio mode configurations — Realistic vs. EDM.
 *
 * Modes modify internal effect parameters without changing the user's knob positions.
 * For the same knob value, EDM mode produces more aggressive/digital results,
 * while Realistic mode produces warmer/more natural results.
 */

export type AudioMode = 'realistic' | 'edm';

export interface ModeConfig {
  /** Filter Q factor. Higher = more resonant peak at cutoff. */
  filterQ: number;

  /** Distortion drive range [min, max]. Higher max = more aggressive clipping. */
  driveRange: [number, number];

  /** Distortion input gain range [min, max]. */
  inputGainRange: [number, number];

  /** Whether to use hard clipping (true) or tanh soft clipping (false). */
  hardClip: boolean;

  /** Reverb type preference for synthetic IR generation. */
  reverbDecayMultiplier: number;

  /** Compressor threshold in dB (lower = more compression). -100 disables. */
  compressorThreshold: number;

  /** Compressor ratio. */
  compressorRatio: number;

  /** Compressor attack in seconds. */
  compressorAttack: number;

  /** Compressor release in seconds. */
  compressorRelease: number;

  /** Transient boost gain (1.0 = no boost). */
  transientBoost: number;
}

export const MODE_CONFIGS: Record<AudioMode, ModeConfig> = {
  realistic: {
    filterQ: 0.7,
    driveRange: [1, 12],
    inputGainRange: [1, 1.5],
    hardClip: false,
    reverbDecayMultiplier: 1.0,
    compressorThreshold: -100, // effectively disabled
    compressorRatio: 1,
    compressorAttack: 0.01,
    compressorRelease: 0.25,
    transientBoost: 1.0,
  },

  edm: {
    filterQ: 2.0,
    driveRange: [1, 30],
    inputGainRange: [1, 2.5],
    hardClip: true,
    reverbDecayMultiplier: 0.6,
    compressorThreshold: -18,
    compressorRatio: 8,
    compressorAttack: 0.001,
    compressorRelease: 0.1,
    transientBoost: 1.4,
  },
};
