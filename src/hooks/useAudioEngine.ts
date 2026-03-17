import { AudioEngine } from "../audio/engine";

/** Returns the singleton AudioEngine instance. */
export function useAudioEngine(): AudioEngine {
  return AudioEngine.getInstance();
}
