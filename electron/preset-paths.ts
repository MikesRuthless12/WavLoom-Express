import { app } from 'electron';
import path from 'node:path';

const isDev = !app.isPackaged;

/**
 * Returns the absolute path to the presets directory.
 * - Dev: <project-root>/presets
 * - Production: <resources>/presets (via extraResources)
 */
export function getPresetsDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', 'presets');
  }
  return path.join(process.resourcesPath, 'presets');
}

/**
 * Resolves a relative preset path (e.g. "kicks/kick-deep.wav")
 * to an absolute filesystem path.
 */
export function resolvePresetPath(relativePath: string): string {
  return path.join(getPresetsDir(), relativePath);
}
