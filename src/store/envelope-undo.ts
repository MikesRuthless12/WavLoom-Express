import type { EnvelopeState } from './audio-store';

const MAX_UNDO = 50;
const MAX_REDO = 20;
const undoStack: EnvelopeState[] = [];
const redoStack: EnvelopeState[] = [];

/** Push a pre-change snapshot onto the undo stack. Clears redo (new edit). */
export function pushEnvelopeUndo(envelope: EnvelopeState): void {
  undoStack.push({ ...envelope });
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  redoStack.length = 0;
}

/** Undo: push current state to redo, pop and return the previous state. */
export function undoEnvelope(current: EnvelopeState): EnvelopeState | null {
  const prev = undoStack.pop();
  if (!prev) return null;
  redoStack.push({ ...current });
  if (redoStack.length > MAX_REDO) {
    redoStack.shift();
  }
  return prev;
}

/** Redo: push current state to undo, pop and return the next state. */
export function redoEnvelope(current: EnvelopeState): EnvelopeState | null {
  const next = redoStack.pop();
  if (!next) return null;
  undoStack.push({ ...current });
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  return next;
}

/** Clear both undo and redo stacks (e.g. when loading a new file). */
export function clearEnvelopeUndoStack(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}
