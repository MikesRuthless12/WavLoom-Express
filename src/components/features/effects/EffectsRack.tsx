import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../../store/audio-store';
import KnobControl from './KnobControl';
import ReverbControls from './ReverbControls';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 2;
  return `${note}${octave}`;
}

function formatTranspose(v: number): string {
  if (v > 0) return `+${v} st`;
  if (v < 0) return `${v} st`;
  return '0 st';
}

function formatPan(v: number): string {
  if (v === 50) return 'C';
  if (v < 50) return `L${50 - v}`;
  return `R${v - 50}`;
}

interface EffectsRackProps {
  disabled?: boolean;
}

export default function EffectsRack({ disabled = false }: EffectsRackProps) {
  const { t } = useTranslation();
  const rootNote = useAudioStore((s) => s.rootNote);
  const pitch = useAudioStore((s) => s.effects.pitch);
  const setRootNote = useAudioStore((s) => s.setRootNote);

  const handleRootNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setRootNote(Number(e.target.value));
    },
    [setRootNote],
  );

  // Build root note options (C1 = MIDI 36 to C7 = MIDI 96)
  const noteOptions: { value: number; label: string }[] = [];
  for (let midi = 36; midi <= 96; midi++) {
    noteOptions.push({ value: midi, label: midiToNoteName(midi) });
  }

  const resultNote = midiToNoteName(rootNote + pitch);

  return (
    <div
      className="flex items-center justify-center gap-6 px-4 py-3 border-t border-border"
      style={disabled ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
    >
      <ReverbControls />
      <KnobControl effect="delay" label={t('effects.delay')} defaultValue={0} />
      <KnobControl
        effect="pitch"
        label={t('effects.transpose')}
        defaultValue={0}
        min={-12}
        max={12}
        formatValue={formatTranspose}
      />
      <KnobControl
        effect="pan"
        label={t('effects.pan')}
        defaultValue={50}
        formatValue={formatPan}
      />
      <KnobControl effect="distortion" label={t('effects.distortion')} defaultValue={0} />
      <KnobControl effect="filter" label={t('effects.filter')} defaultValue={50} />
      <KnobControl effect="volume" label={t('effects.volume')} defaultValue={50} />

      {/* Root note & resulting note */}
      <div className="flex flex-col items-center gap-1 ml-2 pl-4 border-l border-border">
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          {t('effects.note')}
        </span>
        <select
          value={rootNote}
          onChange={handleRootNoteChange}
          className="w-14 h-7 text-xs font-mono text-center bg-surface border border-border rounded-sm text-text-secondary focus:border-primary focus:outline-none cursor-pointer"
          title={t('effects.rootNote')}
          aria-label={t('effects.rootNote')}
        >
          {noteOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className="text-[10px] font-mono"
          style={{ color: pitch !== 0 ? '#39FF14' : '#555555' }}
          title="Resulting note after transpose"
        >
          {pitch !== 0 ? `→ ${resultNote}` : ''}
        </span>
      </div>
    </div>
  );
}
