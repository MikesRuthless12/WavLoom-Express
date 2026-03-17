/**
 * DelayEffect — feedback delay (echo) with dry/wet mix control.
 *
 * Signal flow:
 *   input ─┬─ dryGain ─────────────────────┬─ output
 *          └─ wetGain → delay → feedbackGain ┘
 *                         ↑________↲ (feedback loop)
 *
 * Fixed delay time: 250ms (MVP).
 * setAmount(0–100) controls feedback gain: 0 = no echoes, 100 = ~0.8 feedback.
 */

const DELAY_TIME = 0.25; // 250ms
const MAX_FEEDBACK = 0.8; // safe ceiling to prevent infinite buildup

export class DelayEffect {
  /* ── nodes ── */
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private delay: DelayNode;
  private feedbackGain: GainNode;

  /* ── state ── */
  private amount = 0; // 0–100

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.delay = ctx.createDelay(1); // max 1 second
    this.feedbackGain = ctx.createGain();

    this.delay.delayTime.value = DELAY_TIME;

    // dry path: input → dryGain → output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // wet path: input → wetGain → delay → output
    this.inputNode.connect(this.wetGain);
    this.wetGain.connect(this.delay);
    this.delay.connect(this.outputNode);

    // feedback loop: delay → feedbackGain → delay
    this.delay.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delay);

    // initial state: fully dry, no feedback
    this.dryGain.gain.value = 1;
    this.wetGain.gain.value = 0;
    this.feedbackGain.gain.value = 0;
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
   * Set the delay amount.
   * @param value 0 = no echo, 100 = heavy feedback with multiple repeats.
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));
    const t = this.amount / 100;

    // Wet/dry: crossfade so dry stays present even at high amounts
    this.wetGain.gain.value = t;
    this.dryGain.gain.value = 1 - t * 0.3; // keep dry audible

    // Feedback: scale 0 → MAX_FEEDBACK
    this.feedbackGain.gain.value = t * MAX_FEEDBACK;
  }

  getAmount(): number {
    return this.amount;
  }

  /** Disconnect all internal nodes (for teardown). */
  dispose(): void {
    this.inputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.delay.disconnect();
    this.feedbackGain.disconnect();
    this.outputNode.disconnect();
  }
}
