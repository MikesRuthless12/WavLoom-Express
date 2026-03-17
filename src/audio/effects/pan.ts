/**
 * PanEffect — stereo panning via StereoPannerNode.
 *
 * Knob mapping (0–100):
 *   0   → hard left  (-1)
 *   50  → center     (0)
 *   100 → hard right (+1)
 */

export class PanEffect {
  private inputNode: GainNode;
  private outputNode: GainNode;
  private panner: StereoPannerNode;
  private amount = 50;

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.panner = ctx.createStereoPanner();

    this.inputNode.connect(this.panner);
    this.panner.connect(this.outputNode);
  }

  get input(): GainNode {
    return this.inputNode;
  }

  get output(): GainNode {
    return this.outputNode;
  }

  /**
   * Set the pan amount.
   * @param value 0 = hard left, 50 = center, 100 = hard right.
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));
    this.panner.pan.value = (this.amount - 50) / 50;
  }

  getAmount(): number {
    return this.amount;
  }

  /** Get the raw pan value (-1 to +1). */
  getPanValue(): number {
    return (this.amount - 50) / 50;
  }

  dispose(): void {
    this.inputNode.disconnect();
    this.panner.disconnect();
    this.outputNode.disconnect();
  }
}
