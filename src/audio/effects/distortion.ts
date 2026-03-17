/**
 * DistortionEffect — WaveShaperNode-based distortion with drive control.
 *
 * Signal flow:
 *   input → driveGain → WaveShaperNode → output
 *
 * setAmount(0–100):
 *   - Drive parameter scales based on mode config.
 *   - Input gain scales based on mode config.
 *   - Distortion curve: tanh (realistic) or hard clip (EDM).
 */

const CURVE_SAMPLES = 4096;

export class DistortionEffect {
  /* ── nodes ── */
  private inputNode: GainNode;
  private outputNode: GainNode;
  private driveGain: GainNode;
  private waveshaper: WaveShaperNode;

  /* ── state ── */
  private amount = 0; // 0–100
  private minDrive = 1;
  private maxDrive = 20;
  private minInputGain = 1;
  private maxInputGain = 2;
  private hardClip = false;

  constructor(ctx: AudioContext) {
    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.driveGain = ctx.createGain();
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.oversample = '4x';

    // graph: input → driveGain → waveshaper → output
    this.inputNode.connect(this.driveGain);
    this.driveGain.connect(this.waveshaper);
    this.waveshaper.connect(this.outputNode);

    // initial state: clean (linear curve, gain 1)
    this.driveGain.gain.value = this.minInputGain;
    this.waveshaper.curve = DistortionEffect.buildCurve(this.minDrive, false);
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
   * Set the distortion amount.
   * @param value 0 = clean, 100 = aggressive distortion.
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));
    const t = this.amount / 100;

    const drive = this.minDrive + t * (this.maxDrive - this.minDrive);
    const gain = this.minInputGain + t * (this.maxInputGain - this.minInputGain);

    this.driveGain.gain.value = gain;
    this.waveshaper.curve = DistortionEffect.buildCurve(drive, this.hardClip);
  }

  getAmount(): number {
    return this.amount;
  }

  /** Update drive range and clipping style from mode config. */
  setModeParams(
    driveRange: [number, number],
    inputGainRange: [number, number],
    hardClip: boolean,
  ): void {
    this.minDrive = driveRange[0];
    this.maxDrive = driveRange[1];
    this.minInputGain = inputGainRange[0];
    this.maxInputGain = inputGainRange[1];
    this.hardClip = hardClip;
    // Re-apply current amount with new params
    this.setAmount(this.amount);
  }

  /** Disconnect all internal nodes (for teardown). */
  dispose(): void {
    this.inputNode.disconnect();
    this.driveGain.disconnect();
    this.waveshaper.disconnect();
    this.outputNode.disconnect();
  }

  /* ── curve generation ── */

  /** Generate a distortion curve with the given drive. */
  private static buildCurve(drive: number, hardClip: boolean): Float32Array {
    const curve = new Float32Array(CURVE_SAMPLES);
    const half = CURVE_SAMPLES / 2;

    for (let i = 0; i < CURVE_SAMPLES; i++) {
      const x = (i - half) / half; // −1 to +1
      if (hardClip) {
        // Hard clipping: flat ceiling at ±1/drive, then scale back up
        curve[i] = Math.max(-1, Math.min(1, x * drive));
      } else {
        // Soft clipping via tanh
        curve[i] = Math.tanh(x * drive);
      }
    }

    return curve;
  }
}
