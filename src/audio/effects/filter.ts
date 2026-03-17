/**
 * FilterEffect — BiquadFilterNode-based low-pass / high-pass filter.
 *
 * Signal flow:
 *   input → BiquadFilterNode → output
 *
 * setAmount(0–100):
 *   0–49  = low-pass, frequency 20000Hz→200Hz
 *   50    = bypass (allpass)
 *   51–100 = high-pass, frequency 20Hz→5000Hz
 */

export class FilterEffect {
  /* ── nodes ── */
  private inputNode: GainNode;
  private outputNode: GainNode;
  private biquad: BiquadFilterNode;

  /* ── state ── */
  private amount = 50; // 50 = bypass
  private qValue = 1.0;

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.biquad = ctx.createBiquadFilter();
    this.biquad.Q.value = this.qValue;

    // graph: input → biquad → output
    this.inputNode.connect(this.biquad);
    this.biquad.connect(this.outputNode);

    // initial state: bypass
    this.biquad.type = 'allpass';
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
   * Set the filter amount.
   * @param value 0–49 = low-pass (20kHz→200Hz), 50 = bypass, 51–100 = high-pass (20Hz→5kHz).
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));

    if (this.amount === 50) {
      this.biquad.type = 'allpass';
      return;
    }

    if (this.amount < 50) {
      // Low-pass: 0→20000Hz, 49→200Hz
      this.biquad.type = 'lowpass';
      const t = this.amount / 49; // 0→1
      // Exponential mapping: 200 * (20000/200)^t = 200 * 100^t
      this.biquad.frequency.value = 200 * Math.pow(100, t);
    } else {
      // High-pass: 51→20Hz, 100→5000Hz
      this.biquad.type = 'highpass';
      const t = (this.amount - 51) / 49; // 0→1
      // Exponential mapping: 20 * (5000/20)^t = 20 * 250^t
      this.biquad.frequency.value = 20 * Math.pow(250, t);
    }
  }

  getAmount(): number {
    return this.amount;
  }

  /** Set the filter Q (resonance). */
  setQ(q: number): void {
    this.qValue = q;
    this.biquad.Q.value = q;
  }

  /** Disconnect all internal nodes (for teardown). */
  dispose(): void {
    this.inputNode.disconnect();
    this.biquad.disconnect();
    this.outputNode.disconnect();
  }
}
