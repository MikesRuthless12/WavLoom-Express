import { useState, useRef, useCallback, useEffect } from 'react';

/** Pixels of drag to sweep the full range. */
const DRAG_PIXELS = 150;

interface UseKnobOptions {
  min?: number;
  max?: number;
  defaultValue?: number;
  /** Optional external value — when provided, knob syncs to it (controlled mode). */
  externalValue?: number;
  onChange?: (value: number) => void;
  /** Fires when a drag gesture begins (pointer down). */
  onDragStart?: () => void;
  /** Fires when a drag gesture ends (pointer up). `changed` is true if the value moved. */
  onDragEnd?: (changed: boolean) => void;
  /** Fires immediately before a discrete (non-drag) value change (keyboard / double-click). */
  onChangeStart?: () => void;
}

export default function useKnob({
  min = 0,
  max = 100,
  defaultValue = 50,
  externalValue,
  onChange,
  onDragStart,
  onDragEnd,
  onChangeStart,
}: UseKnobOptions = {}) {
  const [value, setValue] = useState(externalValue ?? defaultValue);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  const range = max - min || 1;

  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)));

  // Sync internal state when external value changes (only when not dragging)
  useEffect(() => {
    if (externalValue !== undefined && !isDragging) {
      const clamped = clamp(externalValue);
      setValue(clamped);
    }
  }, [externalValue, isDragging, min, max]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartValue.current = value;
      onDragStart?.();
    },
    [value, onDragStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const pixelDelta = dragStartY.current - e.clientY;
      const valueDelta = (pixelDelta / DRAG_PIXELS) * range;
      const next = clamp(dragStartValue.current + valueDelta);
      if (next !== value) {
        setValue(next);
        onChange?.(next);
      }
    },
    [isDragging, value, range, min, max, onChange],
  );

  const handlePointerUp = useCallback(() => {
    const changed = value !== dragStartValue.current;
    setIsDragging(false);
    onDragEnd?.(changed);
  }, [value, onDragEnd]);

  const handleDoubleClick = useCallback(() => {
    const def = externalValue ?? defaultValue;
    if (def !== value) {
      onChangeStart?.();
      setValue(def);
      onChange?.(def);
    }
  }, [defaultValue, externalValue, value, onChange, onChangeStart]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      let next: number | null = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        next = clamp(value + step);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        next = clamp(value - step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        next = min;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = max;
      }
      if (next !== null && next !== value) {
        onChangeStart?.();
        setValue(next);
        onChange?.(next);
      }
    },
    [value, min, max, onChange, onChangeStart],
  );

  useEffect(() => {
    if (!isDragging) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [isDragging]);

  return {
    value,
    setValue: (v: number) => {
      const clamped = clamp(v);
      setValue(clamped);
      onChange?.(clamped);
    },
    isDragging,
    knobProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onDoubleClick: handleDoubleClick,
      onKeyDown: handleKeyDown,
    },
  };
}
