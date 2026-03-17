/**
 * AudioEngine — singleton managing the Web Audio API graph.
 *
 * Graph: source → envelopeGain → fadeGain → AnalyserNode → FilterEffect → DistortionEffect
 *        → CompressorNode → TransientGain → DelayEffect → ReverbEffect → VolumeEffect → PanEffect → wetGain → masterGain → masterLimiter → destination
 */

import { DelayEffect } from './effects/delay';
import { DistortionEffect } from './effects/distortion';
import { applyEnvelope, applyFades, type EnvelopeParams } from './effects/envelope';
import { FilterEffect } from './effects/filter';
import { AudioMode, MODE_CONFIGS } from './modes';
import { PanEffect } from './effects/pan';
import { PitchEffect } from './effects/pitch';
import { ReverbEffect, ReverbType } from './effects/reverb';
import { VolumeEffect } from './effects/volume';

export class AudioEngine {
  /* ── singleton ── */
  private static instance: AudioEngine | null = null;

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /* ── state ── */
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private delay: DelayEffect | null = null;
  private distortion: DistortionEffect | null = null;
  private filter: FilterEffect | null = null;
  private pitch: PitchEffect = new PitchEffect();
  private pan: PanEffect | null = null;
  private reverb: ReverbEffect | null = null;
  private volume: VolumeEffect | null = null;
  private modeCompressor: DynamicsCompressorNode | null = null;
  private transientGain: GainNode | null = null;
  private currentMode: AudioMode = 'realistic';

  /* ── envelope & fade gain nodes ── */
  private envelopeGain: GainNode | null = null;
  private fadeGain: GainNode | null = null;
  private envelopeParams: EnvelopeParams = { attack: 0, decay: 0, sustain: 1, release: 0 };
  private envelopeEnabled = false;
  private fadeInFraction = 0;
  private fadeOutFraction = 0;

  /* ── A/B comparison ── */
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private drySource: AudioBufferSourceNode | null = null;
  private abActive = false;
  private abMode = false; // false=A (wet), true=B (dry)

  private playing = false;
  private startedAt = 0; // ctx.currentTime when playback started
  private pauseOffset = 0; // seconds into the buffer when paused
  private onEndedCallback: (() => void) | null = null;

  /* ── one-shot playback (kit slots) ── */
  private oneShotSource: AudioBufferSourceNode | null = null;
  private oneShotPlaying = false;
  private oneShotEndedCallback: (() => void) | null = null;

  /* ── master limiter ── */
  private masterLimiter: DynamicsCompressorNode | null = null;

  /* ── audio context recovery ── */
  private contextSuspendedByBlur = false;
  private deviceChangeHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;

  private constructor() {
    // intentionally empty — context created lazily
  }

  /* ── context bootstrap (call on first user gesture) ── */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;

      // Envelope & fade gain nodes
      this.envelopeGain = this.ctx.createGain();
      this.fadeGain = this.ctx.createGain();

      // Create effects
      this.filter = new FilterEffect(this.ctx);
      this.distortion = new DistortionEffect(this.ctx);
      this.reverb = new ReverbEffect(this.ctx);
      this.delay = new DelayEffect(this.ctx);
      this.volume = new VolumeEffect(this.ctx);
      this.pan = new PanEffect(this.ctx);

      // Mode-dependent nodes: compressor (EDM punch) + transient boost
      this.modeCompressor = this.ctx.createDynamicsCompressor();
      this.transientGain = this.ctx.createGain();

      // A/B gain nodes
      this.wetGain = this.ctx.createGain();
      this.dryGain = this.ctx.createGain();
      this.wetGain.gain.value = 1;
      this.dryGain.gain.value = 0;

      // Master limiter: prevents clipping at extreme effect settings
      this.masterLimiter = this.ctx.createDynamicsCompressor();
      this.masterLimiter.threshold.value = -24;
      this.masterLimiter.knee.value = 30;
      this.masterLimiter.ratio.value = 12;
      this.masterLimiter.attack.value = 0.003;
      this.masterLimiter.release.value = 0.25;

      // graph: envelopeGain → fadeGain → analyser → filter → distortion → modeCompressor → transientGain → delay → reverb → volume → pan → wetGain ─┐
      //                                                                                                                                                ├→ masterGain → masterLimiter → destination
      //        drySource → dryGain ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
      // (pitch is handled via source.playbackRate, not a graph node)
      this.envelopeGain.connect(this.fadeGain);
      this.fadeGain.connect(this.analyser);
      this.analyser.connect(this.filter.input);
      this.filter.output.connect(this.distortion.input);
      this.distortion.output.connect(this.modeCompressor);
      this.modeCompressor.connect(this.transientGain);
      this.transientGain.connect(this.delay.input);
      this.delay.output.connect(this.reverb.input);
      this.reverb.output.connect(this.volume.input);
      this.volume.output.connect(this.pan.input);
      this.pan.output.connect(this.wetGain);
      this.wetGain.connect(this.masterGain);
      this.dryGain.connect(this.masterGain);
      this.masterGain.connect(this.masterLimiter);
      this.masterLimiter.connect(this.ctx.destination);

      // Init IRs in background (non-blocking)
      this.reverb.init();

      // Apply initial mode
      this.applyMode(this.currentMode);

      // ── Audio context recovery ──

      // (1) OS sleep/wake: AudioContext may suspend after system sleep.
      // Detect via onstatechange and resume on next user interaction.
      this.ctx.onstatechange = () => {
        if (this.ctx?.state === 'suspended' && !this.contextSuspendedByBlur) {
          // Auto-resume will happen on next ensureContext() call (user gesture).
          // Also attempt an immediate resume — browsers may allow it.
          this.ctx.resume().catch(() => { /* requires user gesture, will retry */ });
        }
      };

      // (2) System audio device changes: detect and log a warning.
      if (navigator.mediaDevices) {
        this.deviceChangeHandler = () => {
          console.warn('[AudioEngine] Audio device changed. Playback may be affected — restart playback if audio is lost.');
        };
        navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
      }

      // (3) Window focus/blur: pause on blur, allow resume on focus (Electron-specific).
      this.blurHandler = () => {
        if (this.ctx?.state === 'running' && this.playing) {
          this.contextSuspendedByBlur = true;
          this.ctx.suspend();
        }
      };
      this.focusHandler = () => {
        if (this.contextSuspendedByBlur && this.ctx?.state === 'suspended') {
          this.contextSuspendedByBlur = false;
          this.ctx.resume();
        }
      };
      window.addEventListener('blur', this.blurHandler);
      window.addEventListener('focus', this.focusHandler);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /* ── schedule envelope & fade automation ── */
  private scheduleAmplitudeAutomation(): void {
    if (!this.ctx || !this.buffer) return;
    const duration = this.buffer.duration;
    // When called during play(), startedAt is set right after. Use currentTime as base.
    const now = this.ctx.currentTime;
    // How far into the buffer we are (0 on fresh play, >0 on re-schedule)
    const offset = this.playing ? now - this.startedAt : this.pauseOffset;
    const remaining = duration - offset;
    if (remaining <= 0) return;

    // Envelope
    if (this.envelopeEnabled && this.envelopeGain) {
      const gain = this.envelopeGain.gain;
      gain.cancelScheduledValues(now);
      // Calculate the envelope value at the current playback offset
      const { attack, decay, sustain, release } = this.envelopeParams;
      const decayEnd = attack + decay;
      const releaseStart = Math.max(decayEnd, duration - release);
      let currentVal: number;
      if (offset < attack) {
        currentVal = attack > 0 ? offset / attack : 1;
      } else if (offset < decayEnd) {
        const t = decay > 0 ? (offset - attack) / decay : 1;
        currentVal = 1 - t * (1 - sustain);
      } else if (offset < releaseStart) {
        currentVal = sustain;
      } else {
        const t = release > 0 ? (offset - releaseStart) / release : 1;
        currentVal = sustain * (1 - t);
      }
      gain.setValueAtTime(Math.max(0, currentVal), now);

      // Schedule remaining envelope from current position
      if (offset < attack) {
        gain.linearRampToValueAtTime(1, now + (attack - offset));
        gain.linearRampToValueAtTime(sustain, now + (decayEnd - offset));
        if (releaseStart > decayEnd) gain.setValueAtTime(sustain, now + (releaseStart - offset));
        gain.linearRampToValueAtTime(0, now + remaining);
      } else if (offset < decayEnd) {
        gain.linearRampToValueAtTime(sustain, now + (decayEnd - offset));
        if (releaseStart > decayEnd) gain.setValueAtTime(sustain, now + (releaseStart - offset));
        gain.linearRampToValueAtTime(0, now + remaining);
      } else if (offset < releaseStart) {
        gain.setValueAtTime(sustain, now + (releaseStart - offset));
        gain.linearRampToValueAtTime(0, now + remaining);
      } else {
        gain.linearRampToValueAtTime(0, now + remaining);
      }
    } else if (this.envelopeGain) {
      this.envelopeGain.gain.cancelScheduledValues(now);
      this.envelopeGain.gain.setValueAtTime(1, now);
    }

    // Fades
    if ((this.fadeInFraction > 0 || this.fadeOutFraction > 0) && this.fadeGain) {
      const gain = this.fadeGain.gain;
      gain.cancelScheduledValues(now);
      const fadeInTime = this.fadeInFraction * duration;
      const fadeOutStart = duration - this.fadeOutFraction * duration;

      // Current fade value
      let fadeVal = 1;
      if (offset < fadeInTime && fadeInTime > 0) fadeVal = offset / fadeInTime;
      if (offset > fadeOutStart && this.fadeOutFraction > 0) {
        fadeVal = Math.min(fadeVal, (duration - offset) / (this.fadeOutFraction * duration));
      }
      gain.setValueAtTime(Math.max(0, fadeVal), now);

      // Schedule remaining
      if (offset < fadeInTime) {
        gain.linearRampToValueAtTime(1, now + (fadeInTime - offset));
      }
      if (this.fadeOutFraction > 0 && offset < duration) {
        if (offset < fadeOutStart) {
          gain.setValueAtTime(1, now + (fadeOutStart - offset));
        }
        gain.linearRampToValueAtTime(0, now + remaining);
      }
    } else if (this.fadeGain) {
      this.fadeGain.gain.cancelScheduledValues(now);
      this.fadeGain.gain.setValueAtTime(1, now);
    }
  }

  /* ── public API ── */

  async loadBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    this.stop();
    this.buffer = await ctx.decodeAudioData(arrayBuffer);
  }

  async loadFile(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    this.stop();
    try {
      this.buffer = await ctx.decodeAudioData(arrayBuffer);
    } catch {
      throw new Error("Can't read this file.");
    }
    return this.buffer;
  }

  play(): void {
    if (!this.buffer) return;
    if (this.playing) return;

    // Stop any kit-slot one-shot before workspace playback
    this.stopOneShot();

    const ctx = this.ensureContext();

    this.source = ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.pitch.setSource(this.source);
    this.source.connect(this.envelopeGain!);

    this.source.onended = () => {
      if (this.playing) {
        // natural end of buffer
        this.playing = false;
        this.pauseOffset = 0;
        this.stopDrySource();
        this.onEndedCallback?.();
      }
    };

    // Schedule envelope & fade automation
    this.scheduleAmplitudeAutomation();

    this.source.start(0, this.pauseOffset);
    this.startedAt = ctx.currentTime - this.pauseOffset;
    this.playing = true;

    // Start dry source if A/B is active
    if (this.abActive) {
      this.startDrySource();
    }
  }

  pause(): void {
    if (!this.playing || !this.source) return;
    this.pauseOffset = this.ctx!.currentTime - this.startedAt;
    this.source.onended = null;
    this.source.stop();
    this.source.disconnect();
    this.source = null;
    this.stopDrySource();
    this.playing = false;
  }

  stop(): void {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // already stopped
      }
      this.source.disconnect();
      this.source = null;
    }
    this.stopDrySource();
    this.playing = false;
    this.pauseOffset = 0;
    this.startedAt = 0;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  getCurrentTime(): number {
    if (!this.ctx) return 0;
    if (this.playing) {
      return this.ctx.currentTime - this.startedAt;
    }
    return this.pauseOffset;
  }

  setMasterGain(value: number): void {
    this.ensureContext();
    this.masterGain!.gain.value = Math.max(0, Math.min(value, 1));
  }

  isPlaying(): boolean {
    return this.playing;
  }

  seekTo(timeSeconds: number): void {
    if (!this.buffer) return;
    const clamped = Math.max(0, Math.min(timeSeconds, this.buffer.duration));

    if (this.playing) {
      // restart playback from new position
      this.pause();
      this.pauseOffset = clamped;
      this.play();
    } else {
      this.pauseOffset = clamped;
    }
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  /** Register a callback for when playback ends naturally. */
  onEnded(cb: (() => void) | null): void {
    this.onEndedCallback = cb;
  }

  /* ── one-shot playback (kit slots) ── */

  /**
   * Decode and play an audio file as a one-shot, bypassing the effects chain.
   * Stops any current workspace or one-shot playback first.
   * Returns the decoded buffer duration so the caller can decide play behaviour.
   */
  async playOneShot(arrayBuffer: ArrayBuffer): Promise<number> {
    const ctx = this.ensureContext();

    // Stop everything currently playing
    this.stop();
    this.stopOneShot();

    const decoded = await ctx.decodeAudioData(arrayBuffer);

    this.oneShotSource = ctx.createBufferSource();
    this.oneShotSource.buffer = decoded;
    this.oneShotSource.connect(this.masterGain!);

    this.oneShotSource.onended = () => {
      if (this.oneShotPlaying) {
        this.oneShotPlaying = false;
        this.oneShotSource = null;
        this.oneShotEndedCallback?.();
      }
    };

    this.oneShotSource.start(0);
    this.oneShotPlaying = true;

    return decoded.duration;
  }

  stopOneShot(): void {
    if (this.oneShotSource) {
      this.oneShotSource.onended = null;
      try {
        this.oneShotSource.stop();
      } catch {
        // already stopped
      }
      this.oneShotSource.disconnect();
      this.oneShotSource = null;
    }
    this.oneShotPlaying = false;
  }

  isOneShotPlaying(): boolean {
    return this.oneShotPlaying;
  }

  onOneShotEnded(cb: (() => void) | null): void {
    this.oneShotEndedCallback = cb;
  }

  /* ── A/B comparison controls ── */

  private startDrySource(): void {
    if (!this.buffer || !this.ctx) return;
    this.stopDrySource();
    this.drySource = this.ctx.createBufferSource();
    this.drySource.buffer = this.buffer;
    // No pitch or effects — raw original
    this.drySource.connect(this.dryGain!);
    this.drySource.start(0, this.pauseOffset);
  }

  private stopDrySource(): void {
    if (this.drySource) {
      try { this.drySource.stop(); } catch { /* already stopped */ }
      this.drySource.disconnect();
      this.drySource = null;
    }
  }

  setABActive(active: boolean): void {
    this.abActive = active;
    if (!active) {
      // Deactivate: stop dry source, reset gains to wet
      this.stopDrySource();
      this.abMode = false;
      if (this.wetGain) this.wetGain.gain.value = 1;
      if (this.dryGain) this.dryGain.gain.value = 0;
      return;
    }
    // Activate: if mid-playback, create dry source
    if (this.playing) {
      // Update pauseOffset temporarily for startDrySource
      const realOffset = this.ctx!.currentTime - this.startedAt;
      const savedOffset = this.pauseOffset;
      this.pauseOffset = realOffset;
      this.startDrySource();
      this.pauseOffset = savedOffset;
    }
    // Apply current abMode gains
    this.applyABGains();
  }

  setABMode(isB: boolean): void {
    this.abMode = isB;
    this.applyABGains();
  }

  private applyABGains(): void {
    if (!this.ctx || !this.wetGain || !this.dryGain) return;
    const now = this.ctx.currentTime;
    const ramp = 0.005; // ~15ms crossfade
    if (this.abMode) {
      // B = dry/original
      this.wetGain.gain.setTargetAtTime(0, now, ramp);
      this.dryGain.gain.setTargetAtTime(1, now, ramp);
    } else {
      // A = wet/processed
      this.wetGain.gain.setTargetAtTime(1, now, ramp);
      this.dryGain.gain.setTargetAtTime(0, now, ramp);
    }
  }

  isABActive(): boolean {
    return this.abActive;
  }

  getABMode(): boolean {
    return this.abMode;
  }

  /* ── volume controls ── */

  setVolumeAmount(value: number): void {
    this.ensureContext();
    this.volume!.setAmount(value);
  }

  getVolumeAmount(): number {
    return this.volume?.getAmount() ?? 50;
  }

  /* ── pan controls ── */

  setPanAmount(value: number): void {
    this.ensureContext();
    this.pan!.setAmount(value);
  }

  getPanAmount(): number {
    return this.pan?.getAmount() ?? 50;
  }

  /* ── filter controls ── */

  setFilterAmount(value: number): void {
    this.ensureContext();
    this.filter!.setAmount(value);
  }

  getFilterAmount(): number {
    return this.filter?.getAmount() ?? 50;
  }

  /* ── distortion controls ── */

  setDistortionAmount(value: number): void {
    this.ensureContext();
    this.distortion!.setAmount(value);
  }

  getDistortionAmount(): number {
    return this.distortion?.getAmount() ?? 0;
  }

  /* ── pitch controls ── */

  setPitchAmount(value: number): void {
    this.pitch.setAmount(value);
  }

  getPitchAmount(): number {
    return this.pitch.getAmount();
  }

  /* ── delay controls ── */

  setDelayAmount(value: number): void {
    this.ensureContext();
    this.delay!.setAmount(value);
  }

  getDelayAmount(): number {
    return this.delay?.getAmount() ?? 0;
  }

  /* ── reverb controls ── */

  setReverbAmount(value: number): void {
    this.ensureContext();
    this.reverb!.setAmount(value);
  }

  getReverbAmount(): number {
    return this.reverb?.getAmount() ?? 0;
  }

  setReverbType(type: ReverbType): void {
    this.ensureContext();
    this.reverb!.setType(type);
  }

  getReverbType(): ReverbType {
    return this.reverb?.getType() ?? 'small-room';
  }

  /* ── envelope controls ── */

  setEnvelopeEnabled(enabled: boolean): void {
    this.envelopeEnabled = enabled;
    if (this.playing) this.scheduleAmplitudeAutomation();
  }

  setEnvelopeParams(params: EnvelopeParams): void {
    this.envelopeParams = { ...params };
    if (this.playing) this.scheduleAmplitudeAutomation();
  }

  getEnvelopeParams(): EnvelopeParams {
    return { ...this.envelopeParams };
  }

  isEnvelopeEnabled(): boolean {
    return this.envelopeEnabled;
  }

  /* ── fade controls ── */

  setFadeIn(fraction: number): void {
    this.fadeInFraction = Math.max(0, Math.min(1, fraction));
    if (this.playing) this.scheduleAmplitudeAutomation();
  }

  setFadeOut(fraction: number): void {
    this.fadeOutFraction = Math.max(0, Math.min(1, fraction));
    if (this.playing) this.scheduleAmplitudeAutomation();
  }

  getFadeIn(): number {
    return this.fadeInFraction;
  }

  getFadeOut(): number {
    return this.fadeOutFraction;
  }

  /* ── reverse controls ── */

  /**
   * Reverse the loaded audio buffer in-place.
   * Stops playback, reverses all channel data, then returns the reversed buffer.
   */
  reverseBuffer(): AudioBuffer | null {
    if (!this.buffer) return null;
    this.stop();
    for (let ch = 0; ch < this.buffer.numberOfChannels; ch++) {
      this.buffer.getChannelData(ch).reverse();
    }
    return this.buffer;
  }

  /* ── mode controls ── */

  setMode(mode: AudioMode): void {
    this.ensureContext();
    this.currentMode = mode;
    this.applyMode(mode);
  }

  getMode(): AudioMode {
    return this.currentMode;
  }

  private applyMode(mode: AudioMode): void {
    const config = MODE_CONFIGS[mode];

    // Filter resonance
    this.filter!.setQ(config.filterQ);

    // Distortion character
    this.distortion!.setModeParams(
      config.driveRange,
      config.inputGainRange,
      config.hardClip,
    );

    // Mode compressor (punchy compression for EDM, transparent for realistic)
    const comp = this.modeCompressor!;
    if (config.compressorThreshold <= -100) {
      // Effectively bypass: very low threshold disabled, ratio 1:1
      comp.threshold.value = 0;
      comp.ratio.value = 1;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
    } else {
      comp.threshold.value = config.compressorThreshold;
      comp.ratio.value = config.compressorRatio;
      comp.attack.value = config.compressorAttack;
      comp.release.value = config.compressorRelease;
    }
    comp.knee.value = 6;

    // Transient boost
    this.transientGain!.gain.value = config.transientBoost;
  }

  /**
   * Offline-render the loaded buffer through the current effects chain.
   * Returns a new AudioBuffer reflecting the processed audio.
   * Useful for updating the waveform display to show effects.
   */
  async renderProcessed(): Promise<AudioBuffer | null> {
    if (!this.buffer) return null;
    this.ensureContext();

    // Always add a tail to let compressors/limiters release naturally.
    // Without this, the offline render cuts off mid-release → click at the end.
    const hasDelay = this.getDelayAmount() > 0;
    const hasReverb = this.getReverbAmount() > 0;
    const tailSeconds = (hasDelay || hasReverb) ? 2 : 0.1;
    const totalLength = this.buffer.length + Math.ceil(tailSeconds * this.buffer.sampleRate);

    const offline = new OfflineAudioContext(
      this.buffer.numberOfChannels,
      totalLength,
      this.buffer.sampleRate,
    );

    // Cast: OfflineAudioContext has the same factory methods as AudioContext
    const ctx = offline as unknown as AudioContext;

    // Build temporary effects chain with current parameters + mode
    const modeConfig = MODE_CONFIGS[this.currentMode];

    const filter = new FilterEffect(ctx);
    filter.setQ(modeConfig.filterQ);
    filter.setAmount(this.getFilterAmount());

    const distortion = new DistortionEffect(ctx);
    distortion.setModeParams(modeConfig.driveRange, modeConfig.inputGainRange, modeConfig.hardClip);
    distortion.setAmount(this.getDistortionAmount());

    const offlineCompressor = offline.createDynamicsCompressor();
    if (modeConfig.compressorThreshold <= -100) {
      offlineCompressor.threshold.value = 0;
      offlineCompressor.ratio.value = 1;
    } else {
      offlineCompressor.threshold.value = modeConfig.compressorThreshold;
      offlineCompressor.ratio.value = modeConfig.compressorRatio;
      offlineCompressor.attack.value = modeConfig.compressorAttack;
      offlineCompressor.release.value = modeConfig.compressorRelease;
    }
    offlineCompressor.knee.value = 6;

    const offlineTransient = offline.createGain();
    offlineTransient.gain.value = modeConfig.transientBoost;

    const delay = new DelayEffect(ctx);
    delay.setAmount(this.getDelayAmount());

    const reverb = new ReverbEffect(ctx);
    reverb.setAmount(this.getReverbAmount());
    // Copy IR buffers from the live reverb so we don't re-fetch/generate
    const liveIRs = this.reverb!.getIRBuffers();
    for (const [type, irBuffer] of liveIRs) {
      reverb.getIRBuffers().set(type, irBuffer);
    }
    reverb.setType(this.getReverbType());

    // Use VolumeEffect (gain + soft limiter) to match live playback loudness
    const volume = new VolumeEffect(ctx);
    volume.setAmount(this.getVolumeAmount());

    // Pan for offline rendering
    const offlinePan = new PanEffect(ctx);
    offlinePan.setAmount(this.getPanAmount());

    // Envelope gain for offline rendering
    const offlineEnvelopeGain = offline.createGain();
    const bufferDuration = this.buffer.duration;

    // Fade gain for offline rendering
    const offlineFadeGain = offline.createGain();

    // Wire: source → envelopeGain → fadeGain → filter → distortion → compressor → transient → delay → reverb → volume (has internal limiter) → pan → destination
    // Note: no separate master limiter here — VolumeEffect already has a soft limiter
    // that prevents clipping. Adding a second limiter in series over-compresses the
    // signal, making exports ~6-10 dB quieter than live playback.
    const source = offline.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.pitch.getPlaybackRate();

    source.connect(offlineEnvelopeGain);
    offlineEnvelopeGain.connect(offlineFadeGain);
    offlineFadeGain.connect(filter.input);
    filter.output.connect(distortion.input);
    distortion.output.connect(offlineCompressor);
    offlineCompressor.connect(offlineTransient);
    offlineTransient.connect(delay.input);
    delay.output.connect(reverb.input);
    reverb.output.connect(volume.input);
    volume.output.connect(offlinePan.input);
    offlinePan.output.connect(offline.destination);

    // Schedule envelope automation
    if (this.envelopeEnabled) {
      applyEnvelope(offlineEnvelopeGain.gain, this.envelopeParams, 0, bufferDuration);
    }

    // Schedule fade automation
    if (this.fadeInFraction > 0 || this.fadeOutFraction > 0) {
      applyFades(offlineFadeGain.gain, this.fadeInFraction, this.fadeOutFraction, 0, bufferDuration);
    }

    source.start(0);
    const rendered = await offline.startRendering();

    // Cleanup
    filter.dispose();
    distortion.dispose();
    delay.dispose();
    reverb.dispose();
    volume.dispose();
    offlinePan.dispose();

    // Trim leading latency + trailing silence so waveform aligns with original
    const trimmed = trimSilence(rendered);

    // Peak-normalize so exports match perceived playback loudness.
    // The live chain has a second masterLimiter stage that boosts perceived
    // loudness; offline rendering can't replicate that reliably, so instead
    // we normalize peaks to -0.3 dBFS (≈0.966) after trimming.
    peakNormalize(trimmed, -0.3);

    // Always apply a short fade-out at the very end to prevent clicks
    // from non-zero samples at the buffer boundary.
    applyMicroFadeOut(trimmed);

    return trimmed;
  }
}

/**
 * Apply a 5ms fade-out to the very end of a buffer to ensure it ends at zero.
 * This prevents clicks/pops when the audio is played back in a DAW.
 */
function applyMicroFadeOut(buffer: AudioBuffer): void {
  const fadeOutSamples = Math.min(Math.ceil(0.005 * buffer.sampleRate), buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const fadeStart = data.length - fadeOutSamples;
    for (let i = 0; i < fadeOutSamples; i++) {
      data[fadeStart + i] *= 1 - (i / fadeOutSamples);
    }
  }
}

/**
 * Scale every sample so the loudest peak hits `targetDbfs` (e.g. -0.3 dBFS).
 * This compensates for the missing second limiter stage in offline rendering
 * and ensures exports are as loud as live playback without clipping.
 */
function peakNormalize(buffer: AudioBuffer, targetDbfs: number): void {
  const targetLinear = Math.pow(10, targetDbfs / 20); // e.g. -0.3 → ~0.966

  // Find the absolute peak across all channels
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }

  // If the buffer is silent or already at/above target, skip
  if (peak < 1e-6 || peak >= targetLinear) return;

  const gain = targetLinear / peak;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
}

/**
 * Trim leading and trailing silence from an AudioBuffer.
 * Leading silence is introduced by effects chain latency (compressor lookahead).
 * Trailing silence comes from the extra tail added for delay/reverb.
 */
function trimSilence(buffer: AudioBuffer, threshold = 0.0005): AudioBuffer {
  const { numberOfChannels, sampleRate } = buffer;
  let firstLoudSample = buffer.length;
  let lastLoudSample = 0;

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > threshold) {
        firstLoudSample = Math.min(firstLoudSample, i);
        break;
      }
    }
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i]) > threshold) {
        lastLoudSample = Math.max(lastLoudSample, i);
        break;
      }
    }
  }

  // If no loud samples found (silent buffer), return as-is
  if (firstLoudSample >= buffer.length || lastLoudSample <= 0) return buffer;
  // Sanity: ensure end > start
  if (lastLoudSample < firstLoudSample) return buffer;

  const leadPad = 2;
  const trailPad = Math.ceil(0.05 * sampleRate);
  const trimStart = Math.max(0, firstLoudSample - leadPad);
  const trimEnd = Math.min(lastLoudSample + trailPad, buffer.length);
  const trimLength = trimEnd - trimStart;

  // Nothing meaningful to trim, or invalid length
  if (trimLength <= 0 || trimLength >= buffer.length) return buffer;
  if (trimStart === 0 && trimEnd === buffer.length) return buffer;

  const ctx = new OfflineAudioContext(numberOfChannels, trimLength, sampleRate);
  const trimmed = ctx.createBuffer(numberOfChannels, trimLength, sampleRate);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    trimmed.getChannelData(ch).set(buffer.getChannelData(ch).subarray(trimStart, trimEnd));
  }

  return trimmed;
}
