/**
 * PitchEffect — playback-rate-based pitch shifting (transpose).
 *
 * Semitone mapping (-12 to +12):
 *   -12 → playbackRate 0.5  (one octave down)
 *     0 → playbackRate 1.0  (no change)
 *   +12 → playbackRate 2.0  (one octave up)
 *
 * Uses: rate = 2^(semitones/12)
 */

export class PitchEffect {
  private semitones = 0; // -12 to +12
  private source: AudioBufferSourceNode | null = null;

  /** Attach to the current source node. Call each time a new source is created. */
  setSource(source: AudioBufferSourceNode | null): void {
    this.source = source;
    this.applyRate();
  }

  /**
   * Set the transpose amount in semitones.
   * @param value -12 to +12 semitones.
   */
  setAmount(value: number): void {
    this.semitones = Math.max(-12, Math.min(12, Math.round(value)));
    this.applyRate();
  }

  getAmount(): number {
    return this.semitones;
  }

  /** Convert semitones to a playback rate multiplier. */
  getPlaybackRate(): number {
    return Math.pow(2, this.semitones / 12);
  }

  private applyRate(): void {
    if (this.source) {
      this.source.playbackRate.value = this.getPlaybackRate();
    }
  }
}
