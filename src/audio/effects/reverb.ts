/**
 * ReverbEffect — convolution-based reverb with dry/wet mix control.
 *
 * Uses a ConvolverNode with synthetic impulse responses for three preset types:
 * small room, large hall, and plate reverb.
 *
 * Signal flow:
 *   input ─┬─ dryGain ────────────┬─ output
 *          └─ convolver → wetGain ─┘
 */

export type ReverbType = "small-room" | "large-hall" | "plate";

export class ReverbEffect {
  private ctx: AudioContext;

  /* ── nodes ── */
  private inputNode: GainNode;
  private outputNode: GainNode;
  private dryGain: GainNode;
  private wetGain: GainNode;
  private convolver: ConvolverNode;

  /* ── state ── */
  private amount = 0; // 0–100
  private currentType: ReverbType = "small-room";
  private irBuffers: Map<ReverbType, AudioBuffer> = new Map();
  private ready = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.convolver = ctx.createConvolver();

    // Set a passthrough impulse so the convolver doesn't produce garbage
    // before the real IRs are loaded asynchronously
    const passthrough = ctx.createBuffer(2, 1, ctx.sampleRate);
    passthrough.getChannelData(0)[0] = 1;
    passthrough.getChannelData(1)[0] = 1;
    this.convolver.buffer = passthrough;

    // dry path: input → dryGain → output
    this.inputNode.connect(this.dryGain);
    this.dryGain.connect(this.outputNode);

    // wet path: input → convolver → wetGain → output
    this.inputNode.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.outputNode);

    // initial mix: fully dry
    this.dryGain.gain.value = 1;
    this.wetGain.gain.value = 0;
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
   * Initialize all impulse response buffers.
   * Call once after construction; resolves when all IRs are ready.
   */
  async init(): Promise<void> {
    await Promise.all([
      this.loadOrGenerateIR("small-room"),
      this.loadOrGenerateIR("large-hall"),
      this.loadOrGenerateIR("plate"),
    ]);
    this.setType(this.currentType);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Set the dry/wet mix amount.
   * @param value 0 = fully dry, 100 = fully wet.
   */
  setAmount(value: number): void {
    this.amount = Math.max(0, Math.min(100, value));
    const wet = this.amount / 100;
    this.dryGain.gain.value = 1 - wet;
    this.wetGain.gain.value = wet;
  }

  getAmount(): number {
    return this.amount;
  }

  /** Switch the active impulse response preset. */
  setType(type: ReverbType): void {
    this.currentType = type;
    const buf = this.irBuffers.get(type);
    if (buf) {
      this.convolver.buffer = buf;
    }
  }

  getType(): ReverbType {
    return this.currentType;
  }

  /** Get the loaded IR buffers (for offline rendering). */
  getIRBuffers(): Map<ReverbType, AudioBuffer> {
    return this.irBuffers;
  }

  /** Disconnect all internal nodes (for teardown). */
  dispose(): void {
    this.inputNode.disconnect();
    this.dryGain.disconnect();
    this.wetGain.disconnect();
    this.convolver.disconnect();
    this.outputNode.disconnect();
  }

  /* ── IR loading ── */

  /**
   * Try to fetch a WAV IR from public/impulse-responses/.
   * Falls back to generating a synthetic IR if the file isn't available.
   */
  private async loadOrGenerateIR(type: ReverbType): Promise<void> {
    const path = `/impulse-responses/${type}.wav`;
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.irBuffers.set(type, audioBuffer);
    } catch {
      // WAV file not available — generate a synthetic IR
      this.irBuffers.set(type, this.generateIR(type));
    }
  }

  /* ── synthetic IR generation ── */

  private generateIR(type: ReverbType): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;

    switch (type) {
      case "small-room":
        return this.buildIR(sampleRate, 0.6, 3.0, 800);
      case "large-hall":
        return this.buildIR(sampleRate, 2.5, 1.2, 2500);
      case "plate":
        return this.buildIR(sampleRate, 1.8, 2.0, 5000);
    }
  }

  /**
   * Build a stereo impulse response buffer using exponential decay with
   * filtered noise. Parameters control the reverb character.
   *
   * @param sampleRate  Audio context sample rate.
   * @param duration    Reverb tail length in seconds.
   * @param decay       Decay rate — higher values decay faster.
   * @param lpFreq      Low-pass cutoff to shape brightness.
   */
  private buildIR(
    sampleRate: number,
    duration: number,
    decay: number,
    lpFreq: number
  ): AudioBuffer {
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    const lpCoeff = Math.exp((-2 * Math.PI * lpFreq) / sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let filtered = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        const envelope = Math.exp(-decay * t);

        // simple one-pole low-pass filter on the noise
        filtered = filtered * lpCoeff + noise * (1 - lpCoeff);

        data[i] = filtered * envelope;
      }
    }

    return buffer;
  }
}
