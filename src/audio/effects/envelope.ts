/**
 * Envelope helpers — ADSR gain automation + fade in/out.
 */

export interface EnvelopeParams {
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // 0–1 level
  release: number; // seconds
}

/**
 * Schedule ADSR gain automation on a GainNode's gain param.
 * Call once when playback starts (startTime = ctx.currentTime).
 */
export function applyEnvelope(
  gain: AudioParam,
  params: EnvelopeParams,
  startTime: number,
  duration: number,
): void {
  const { attack, decay, sustain, release } = params;

  gain.cancelScheduledValues(startTime);
  gain.setValueAtTime(0, startTime);

  const attackEnd = startTime + attack;
  gain.linearRampToValueAtTime(1, attackEnd);

  const decayEnd = attackEnd + decay;
  gain.linearRampToValueAtTime(sustain, decayEnd);

  // Sustain holds until release starts
  const releaseStart = startTime + Math.max(attack + decay, duration - release);
  if (releaseStart > decayEnd) {
    gain.setValueAtTime(sustain, releaseStart);
  }

  gain.linearRampToValueAtTime(0, startTime + duration);
}

/**
 * Schedule fade-in and/or fade-out gain automation.
 * Fades are specified as fractions of the total duration (0–1).
 */
export function applyFades(
  gain: AudioParam,
  fadeInFraction: number,
  fadeOutFraction: number,
  startTime: number,
  duration: number,
): void {
  const fadeInTime = fadeInFraction * duration;
  const fadeOutTime = fadeOutFraction * duration;

  gain.cancelScheduledValues(startTime);

  if (fadeInTime > 0) {
    gain.setValueAtTime(0, startTime);
    gain.linearRampToValueAtTime(1, startTime + fadeInTime);
  } else {
    gain.setValueAtTime(1, startTime);
  }

  if (fadeOutTime > 0) {
    const fadeOutStart = startTime + duration - fadeOutTime;
    // Only schedule if fade-out starts after fade-in ends
    if (fadeOutStart > startTime + fadeInTime) {
      gain.setValueAtTime(1, fadeOutStart);
    }
    gain.linearRampToValueAtTime(0, startTime + duration);
  }
}

/**
 * Calculate the envelope gain value at a specific time offset.
 * Used for resuming playback from a paused position.
 */
export function getEnvelopeValueAt(
  params: EnvelopeParams,
  time: number,
  duration: number,
): number {
  const { attack, decay, sustain, release } = params;
  const decayEnd = attack + decay;
  const releaseStart = Math.max(decayEnd, duration - release);

  if (time <= 0) return 0;
  if (time < attack) return time / attack;
  if (time < decayEnd) return 1 - ((time - attack) / decay) * (1 - sustain);
  if (time < releaseStart) return sustain;
  if (time < duration) return sustain * (1 - (time - releaseStart) / release);
  return 0;
}

/**
 * Calculate the fade gain value at a specific time offset.
 */
export function getFadeValueAt(
  fadeInFraction: number,
  fadeOutFraction: number,
  time: number,
  duration: number,
): number {
  const fadeInTime = fadeInFraction * duration;
  const fadeOutTime = fadeOutFraction * duration;
  const fadeOutStart = duration - fadeOutTime;

  let gain = 1;
  if (fadeInTime > 0 && time < fadeInTime) {
    gain = time / fadeInTime;
  }
  if (fadeOutTime > 0 && time > fadeOutStart) {
    gain = Math.min(gain, (duration - time) / fadeOutTime);
  }
  return Math.max(0, gain);
}
