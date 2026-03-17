/**
 * VolumeEffect — master volume with soft limiter.
 *
 * Signal flow:
 *   input → GainNode (master) → DynamicsCompressorNode (limiter) → output
 *
 * setAmount(0–100):
 *   0  = silence (gain 0)
 *   50 = unity gain (1.0, 0dB)
 *   100 = boost (gain ~2.0, +6dB)
 *
 * The compressor acts as a soft limiter to prevent clipping at extreme settings.
 */

const LIMITER_THRESHOLD = -24;
const LIMITER_KNEE = 30;
const LIMITER_RATIO = 12;
const LIMITER_ATTACK = 0.003;
const LIMITER_RELEASE = 0.25;

export class VolumeEffect {
  /* ── nodes ── */
  private inputNode: GainNode;
  private outputNode: GainNode;
  private masterGain: GainNode;
  private limiter: DynamicsCompressorNode;

  /* ── state ── */
  private amount = 50; // 0–100, default unity

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.masterGain = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();

    // Configure soft limiter
    this.limiter.threshold.value = LIMITER_THRESHOLD;
    this.limiter.knee.value = LIMITER_KNEE;
    this.limiter.ratio.value = LIMITER_RATIO;
    this.limiter.attack.value = LIMITER_ATTACK;
    this.limiter.release.value = LIMITER_RELEASE;

    // graph: input → masterGain → limiter → output
    this.inputNode.connect(this.masterGain);
    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.outputNode);

    // initial state: unity gain
    this.masterGain.gain.value = 1.0;
  }

  /* ── public API ── */

  /** The node other effects or sources should connect *to*. */
  get input(): GainNode {
    return this.inputNode;
  }

  /** The node to connect *from* to the next effect or destination. */
  get output(): GainNode {
    return this.outputNode;
  }

  /**
   * Set the volume amount.
   * @param value 0 = silence, 50 = unity (1.0), 100 = boost (~2.0 / +6dB).
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));

    if (this.amount <= 50) {
      // 0–50: silence to unity (quadratic for perceptual linearity)
      const norm = this.amount / 50; // 0→1
      this.masterGain.gain.value = norm * norm;
    } else {
      // 50–100: unity to boost (+6dB at max)
      const norm = (this.amount - 50) / 50; // 0→1
      this.masterGain.gain.value = 1.0 + norm; // 1.0→2.0
    }
  }

  getAmount(): number {
    return this.amount;
  }

  /** Disconnect all internal nodes (for teardown). */
  dispose(): void {
    this.inputNode.disconnect();
    this.masterGain.disconnect();
    this.limiter.disconnect();
    this.outputNode.disconnect();
  }
}
