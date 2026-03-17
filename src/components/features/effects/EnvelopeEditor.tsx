import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore, type EnvelopeState } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';
import { pushEnvelopeUndo } from '../../../store/envelope-undo';
import Knob from '../../ui/Knob';

const MAX_ATTACK = 5000;
const MAX_DECAY = 5000;
const MAX_RELEASE = 10000;
const PAD = 12;
const DOT_R = 6;

const SVG_W = 400;
const SVG_H = 110;
const W = SVG_W - PAD * 2;
const H = SVG_H - PAD * 2;

// Fixed section boundaries (fractions of drawable width)
// Each dot lives in its own lane so dragging one never shifts others.
const SEC_A_START = PAD;
const SEC_A_END = PAD + W * 0.2;
const SEC_D_END = PAD + W * 0.5;
const SEC_S_END = PAD + W * 0.75;
const SEC_R_END = PAD + W;

function fmtTime(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}s`;
  return `${v} ms`;
}

function fmtSustain(v: number): string {
  if (v <= 0) return '-inf';
  const db = 20 * Math.log10(v / 100);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)}dB`;
}

/** Map a 0–max value to a pixel x within [xStart, xEnd]. */
function valToX(val: number, max: number, xStart: number, xEnd: number): number {
  return xStart + (val / max) * (xEnd - xStart);
}

/** Map a pixel x within [xStart, xEnd] back to a 0–max value. */
function xToVal(x: number, max: number, xStart: number, xEnd: number): number {
  const frac = (x - xStart) / (xEnd - xStart);
  return Math.round(Math.max(0, Math.min(max, frac * max)));
}

function getPoints(attack: number, decay: number, sustain: number, release: number) {
  const sus = sustain / 100;
  const susY = PAD + H * (1 - sus);

  const attackX = valToX(attack, MAX_ATTACK, SEC_A_START, SEC_A_END);
  const decayX = valToX(decay, MAX_DECAY, SEC_A_END, SEC_D_END);
  const releaseX = SEC_S_END + (1 - release / MAX_RELEASE) * (SEC_R_END - SEC_S_END);

  return {
    start: { x: PAD, y: PAD + H },         // bottom-left
    attackPt: { x: attackX, y: PAD },        // top of attack
    decayPt: { x: decayX, y: susY },         // end of decay at sustain level
    sustainEnd: { x: SEC_S_END, y: susY },   // end of sustain hold (fixed x)
    releasePt: { x: releaseX, y: susY },     // start of release curve
    end: { x: SEC_R_END, y: PAD + H },      // bottom-right
  };
}

function buildCurvePath(pts: ReturnType<typeof getPoints>) {
  const { start, attackPt, decayPt, sustainEnd, releasePt, end } = pts;
  const decayCpX = attackPt.x + (decayPt.x - attackPt.x) * 0.3;
  const relCpX = releasePt.x + (end.x - releasePt.x) * 0.3;

  return [
    `M${start.x},${start.y}`,
    `L${attackPt.x > start.x ? start.x : start.x},${attackPt.y}`,
    `L${attackPt.x},${attackPt.y}`,
    `Q${decayCpX},${attackPt.y} ${decayPt.x},${decayPt.y}`,
    `L${sustainEnd.x},${sustainEnd.y}`,
    `L${releasePt.x},${releasePt.y}`,
    `Q${relCpX},${releasePt.y} ${end.x},${end.y}`,
  ].join(' ');
}

type DragTarget = 'attack' | 'decay' | 'release' | null;

export default function EnvelopeEditor() {
  const { t } = useTranslation();
  const envelope = useAudioStore((s) => s.envelope);
  const setEnvelope = useAudioStore((s) => s.setEnvelope);
  const engine = AudioEngine.getInstance();
  const svgRef = useRef<SVGSVGElement>(null);
  const preChangeRef = useRef<EnvelopeState | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [selected, setSelected] = useState<DragTarget>(null);

  // Auto-enable when any ADSR value deviates from defaults
  const hasNonDefaultValues = envelope.attack > 0 || envelope.decay > 0 || envelope.sustain < 100 || envelope.release > 0;

  // Sync engine
  useEffect(() => {
    const active = envelope.enabled || hasNonDefaultValues;
    engine.setEnvelopeEnabled(active);
    engine.setEnvelopeParams({
      attack: envelope.attack / 1000,
      decay: envelope.decay / 1000,
      sustain: envelope.sustain / 100,
      release: envelope.release / 1000,
    });
  }, [envelope, hasNonDefaultValues, engine]);

  const handleToggle = useCallback(() => {
    setEnvelope({ enabled: !envelope.enabled });
  }, [envelope.enabled, setEnvelope]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SVG_W,
      y: ((clientY - rect.top) / rect.height) * SVG_H,
    };
  }, []);

  const handleDotDown = useCallback(
    (target: DragTarget, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as SVGElement).setPointerCapture(e.pointerId);
      preChangeRef.current = { ...useAudioStore.getState().envelope };
      setDragTarget(target);
      setSelected(target);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget) return;
      const { x, y } = toSvg(e.clientX, e.clientY);
      const cx = Math.max(PAD, Math.min(SVG_W - PAD, x));
      const cy = Math.max(PAD, Math.min(SVG_H - PAD, y));

      if (dragTarget === 'attack') {
        // Attack dot tracks cursor x within the A section
        const val = xToVal(cx, MAX_ATTACK, SEC_A_START, SEC_A_END);
        setEnvelope({ attack: val });
      } else if (dragTarget === 'decay') {
        // Decay dot tracks cursor x in D section, y for sustain
        const val = xToVal(cx, MAX_DECAY, SEC_A_END, SEC_D_END);
        const susNorm = 1 - ((cy - PAD) / H);
        const susPct = Math.round(Math.max(0, Math.min(100, susNorm * 100)));
        setEnvelope({ decay: val, sustain: susPct });
      } else if (dragTarget === 'release') {
        // Release dot tracks cursor x in R section (inverted: left = more release)
        const frac = (cx - SEC_S_END) / (SEC_R_END - SEC_S_END);
        const val = Math.round(Math.max(0, Math.min(MAX_RELEASE, (1 - frac) * MAX_RELEASE)));
        setEnvelope({ release: val });
      }
    },
    [dragTarget, toSvg, setEnvelope],
  );

  const handlePointerUp = useCallback(() => {
    if (dragTarget && preChangeRef.current) {
      const current = useAudioStore.getState().envelope;
      const pre = preChangeRef.current;
      const changed = pre.attack !== current.attack || pre.decay !== current.decay
        || pre.sustain !== current.sustain || pre.release !== current.release;
      if (changed) {
        pushEnvelopeUndo(pre);
      }
    }
    preChangeRef.current = null;
    setDragTarget(null);
  }, [dragTarget]);

  const handleSvgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === svgRef.current) setSelected(null);
  }, []);

  useEffect(() => {
    if (!dragTarget) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [dragTarget]);

  // Knob handlers
  const onAttackKnob = useCallback((v: number) => setEnvelope({ attack: v }), [setEnvelope]);
  const onDecayKnob = useCallback((v: number) => setEnvelope({ decay: v }), [setEnvelope]);
  const onSustainKnob = useCallback((v: number) => setEnvelope({ sustain: v }), [setEnvelope]);
  const onReleaseKnob = useCallback((v: number) => setEnvelope({ release: v }), [setEnvelope]);

  // Undo capture for knob interactions
  const knobPreChangeRef = useRef<EnvelopeState | null>(null);
  const handleKnobDragStart = useCallback(() => {
    knobPreChangeRef.current = { ...useAudioStore.getState().envelope };
  }, []);
  const handleKnobDragEnd = useCallback((changed: boolean) => {
    if (changed && knobPreChangeRef.current) {
      pushEnvelopeUndo(knobPreChangeRef.current);
    }
    knobPreChangeRef.current = null;
  }, []);
  const handleKnobChangeStart = useCallback(() => {
    pushEnvelopeUndo({ ...useAudioStore.getState().envelope });
  }, []);

  const pts = getPoints(envelope.attack, envelope.decay, envelope.sustain, envelope.release);
  const curvePath = buildCurvePath(pts);
  const bottom = SVG_H - PAD;
  const fillPath = `${curvePath} L${SEC_R_END},${bottom} L${PAD},${bottom} Z`;

  const dimmed = !envelope.enabled;

  const dotStyle = (target: DragTarget) => ({
    fill: dragTarget === target || selected === target ? '#39FF14' : 'transparent',
    stroke: dragTarget === target ? '#fff' : selected === target ? '#39FF14' : 'rgba(57,255,20,0.6)',
  });

  return (
    <div
      className="px-4 py-2 border-t border-border select-none"
      style={dimmed ? { opacity: 0.4 } : undefined}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] font-bold transition-colors"
          style={{
            borderColor: envelope.enabled ? '#39FF14' : '#2A2A2A',
            color: envelope.enabled ? '#39FF14' : '#555',
            backgroundColor: envelope.enabled ? 'rgba(57,255,20,0.1)' : 'transparent',
          }}
          aria-label={envelope.enabled ? t('envelope.disable') : t('envelope.enable')}
          aria-pressed={envelope.enabled}
        >
          E
        </button>
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          {t('envelope.title')}
        </span>
      </div>

      {/* Curve */}
      <div className="rounded-t overflow-hidden" style={{ backgroundColor: '#1A1A1A' }}>
        <svg
          ref={svgRef}
          width="100%"
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          style={{ touchAction: 'none', display: 'block' }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerDown={handleSvgPointerDown}
        >
          {/* Grid */}
          <line x1={PAD} y1={PAD + H * 0.25} x2={SVG_W - PAD} y2={PAD + H * 0.25} stroke="#252525" strokeWidth="0.5" />
          <line x1={PAD} y1={PAD + H * 0.5} x2={SVG_W - PAD} y2={PAD + H * 0.5} stroke="#252525" strokeWidth="0.5" />
          <line x1={PAD} y1={PAD + H * 0.75} x2={SVG_W - PAD} y2={PAD + H * 0.75} stroke="#252525" strokeWidth="0.5" />

          {/* Fill */}
          <path d={fillPath} fill="rgba(57,255,20,0.04)" />

          {/* Curve */}
          <path d={curvePath} fill="none" stroke="#39FF14" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Dot: Attack */}
          <circle cx={pts.attackPt.x} cy={pts.attackPt.y} r={DOT_R} {...dotStyle('attack')} strokeWidth="2" onPointerDown={(e) => handleDotDown('attack', e)} />
          {/* Dot: Decay/Sustain */}
          <circle cx={pts.decayPt.x} cy={pts.decayPt.y} r={DOT_R} {...dotStyle('decay')} strokeWidth="2" onPointerDown={(e) => handleDotDown('decay', e)} />
          {/* Dot: Release */}
          <circle cx={pts.releasePt.x} cy={pts.releasePt.y} r={DOT_R} {...dotStyle('release')} strokeWidth="2" onPointerDown={(e) => handleDotDown('release', e)} />
        </svg>
      </div>

      {/* ADSR Knobs */}
      <div
        className="flex items-center justify-center gap-4 rounded-b py-2 px-3"
        style={{ backgroundColor: '#111', borderTop: '2px solid #39FF14' }}
      >
        <Knob label="A" defaultValue={0} value={envelope.attack} min={0} max={MAX_ATTACK} onChange={onAttackKnob} onDragStart={handleKnobDragStart} onDragEnd={handleKnobDragEnd} onChangeStart={handleKnobChangeStart} formatValue={fmtTime} />
        <Knob label="D" defaultValue={0} value={envelope.decay} min={0} max={MAX_DECAY} onChange={onDecayKnob} onDragStart={handleKnobDragStart} onDragEnd={handleKnobDragEnd} onChangeStart={handleKnobChangeStart} formatValue={fmtTime} />
        <Knob label="S" defaultValue={100} value={envelope.sustain} min={0} max={100} onChange={onSustainKnob} onDragStart={handleKnobDragStart} onDragEnd={handleKnobDragEnd} onChangeStart={handleKnobChangeStart} formatValue={fmtSustain} />
        <Knob label="R" defaultValue={0} value={envelope.release} min={0} max={MAX_RELEASE} onChange={onReleaseKnob} onDragStart={handleKnobDragStart} onDragEnd={handleKnobDragEnd} onChangeStart={handleKnobChangeStart} formatValue={fmtTime} />
      </div>
    </div>
  );
}
