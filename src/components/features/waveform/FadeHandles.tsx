import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';

/**
 * FadeHandles — overlay on the waveform container providing draggable
 * fade-in (left) and fade-out (right) handles.
 *
 * Fade values are stored as fractions of the total duration (0–1).
 * The handles cannot overlap.
 */
export default function FadeHandles() {
  const { t } = useTranslation();
  const fade = useAudioStore((s) => s.fade);
  const setFade = useAudioStore((s) => s.setFade);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);
  const engine = AudioEngine.getInstance();

  // Sync with engine
  useEffect(() => {
    engine.setFadeIn(fade.fadeIn);
    engine.setFadeOut(fade.fadeOut);
  }, [fade.fadeIn, fade.fadeOut, engine]);

  const handlePointerDown = useCallback(
    (which: 'in' | 'out', e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(which);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));

      if (dragging === 'in') {
        // Fade in: fraction from left, cannot exceed (1 - fadeOut)
        const maxIn = 1 - fade.fadeOut;
        const clamped = Math.min(fraction, maxIn);
        setFade({ fadeIn: Math.round(clamped * 1000) / 1000 });
      } else {
        // Fade out: fraction from right = 1 - fraction
        const fadeOutFrac = 1 - fraction;
        const maxOut = 1 - fade.fadeIn;
        const clamped = Math.max(0, Math.min(fadeOutFrac, maxOut));
        setFade({ fadeOut: Math.round(clamped * 1000) / 1000 });
      }
    },
    [dragging, fade.fadeIn, fade.fadeOut, setFade],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Prevent text selection while dragging
  useEffect(() => {
    if (!dragging) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [dragging]);

  const fadeInPct = fade.fadeIn * 100;
  const fadeOutPct = fade.fadeOut * 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Fade-in gradient overlay */}
      {fade.fadeIn > 0 && (
        <div
          className="absolute top-0 left-0 bottom-0"
          style={{
            width: `${fadeInPct}%`,
            background: 'linear-gradient(to right, rgba(0,0,0,0.7), transparent)',
          }}
        />
      )}

      {/* Fade-out gradient overlay */}
      {fade.fadeOut > 0 && (
        <div
          className="absolute top-0 right-0 bottom-0"
          style={{
            width: `${fadeOutPct}%`,
            background: 'linear-gradient(to left, rgba(0,0,0,0.7), transparent)',
          }}
        />
      )}

      {/* Fade-in handle (left side) */}
      <div
        className="absolute top-0 pointer-events-auto cursor-ew-resize"
        role="slider"
        tabIndex={0}
        aria-label={t('waveform.fadeInAria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fadeInPct)}
        style={{
          left: `${fadeInPct}%`,
          transform: 'translateX(-50%)',
          width: 16,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onPointerDown={(e) => handlePointerDown('in', e)}
      >
        {/* Triangle handle pointing right */}
        <svg width="12" height="16" viewBox="0 0 12 16" style={{ marginTop: 2 }}>
          <path
            d="M0 0 L12 8 L0 16 Z"
            fill={dragging === 'in' ? '#39FF14' : '#888'}
          />
        </svg>
        {/* Vertical guide line */}
        {fade.fadeIn > 0 && (
          <div
            className="flex-1 w-px"
            style={{ backgroundColor: dragging === 'in' ? '#39FF14' : '#555' }}
          />
        )}
      </div>

      {/* Fade-out handle (right side) */}
      <div
        className="absolute top-0 pointer-events-auto cursor-ew-resize"
        role="slider"
        tabIndex={0}
        aria-label={t('waveform.fadeOutAria')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fadeOutPct)}
        style={{
          right: `${fadeOutPct}%`,
          transform: 'translateX(50%)',
          width: 16,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onPointerDown={(e) => handlePointerDown('out', e)}
      >
        {/* Triangle handle pointing left */}
        <svg width="12" height="16" viewBox="0 0 12 16" style={{ marginTop: 2 }}>
          <path
            d="M12 0 L0 8 L12 16 Z"
            fill={dragging === 'out' ? '#39FF14' : '#888'}
          />
        </svg>
        {/* Vertical guide line */}
        {fade.fadeOut > 0 && (
          <div
            className="flex-1 w-px"
            style={{ backgroundColor: dragging === 'out' ? '#39FF14' : '#555' }}
          />
        )}
      </div>

      {/* Fade-in label */}
      {fade.fadeIn > 0.01 && (
        <span
          className="absolute text-[9px] font-mono pointer-events-none"
          style={{
            left: `${fadeInPct / 2}%`,
            top: 4,
            transform: 'translateX(-50%)',
            color: '#39FF14',
            opacity: 0.7,
          }}
        >
          {t('waveform.fadeIn')}
        </span>
      )}

      {/* Fade-out label */}
      {fade.fadeOut > 0.01 && (
        <span
          className="absolute text-[9px] font-mono pointer-events-none"
          style={{
            right: `${fadeOutPct / 2}%`,
            top: 4,
            transform: 'translateX(50%)',
            color: '#39FF14',
            opacity: 0.7,
          }}
        >
          {t('waveform.fadeOut')}
        </span>
      )}
    </div>
  );
}
