import { useCallback, useRef } from 'react';
import { AudioEngine } from '../../../audio/engine';
import { useAudioStore, type EffectsState } from '../../../store/audio-store';
import { pushEffectsUndo } from '../../../store/effects-undo';
import Knob from '../../ui/Knob';

type EffectName = keyof EffectsState;

const effectSetters: Record<EffectName, (engine: AudioEngine, value: number) => void> = {
  reverb: (e, v) => e.setReverbAmount(v),
  delay: (e, v) => e.setDelayAmount(v),
  pitch: (e, v) => e.setPitchAmount(v),
  distortion: (e, v) => e.setDistortionAmount(v),
  filter: (e, v) => e.setFilterAmount(v),
  volume: (e, v) => e.setVolumeAmount(v),
  pan: (e, v) => e.setPanAmount(v),
};

interface KnobControlProps {
  effect: EffectName;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
}

export default function KnobControl({ effect, label, defaultValue, min = 0, max = 100, formatValue }: KnobControlProps) {
  const setEffect = useAudioStore((s) => s.setEffect);
  const effectValue = useAudioStore((s) => s.effects[effect]);
  const preChangeRef = useRef<EffectsState | null>(null);

  const handleChange = useCallback(
    (value: number) => {
      const engine = AudioEngine.getInstance();
      effectSetters[effect](engine, value);
      setEffect(effect, value);
    },
    [effect, setEffect],
  );

  // Drag: capture effects state at start, push to undo on end (if changed)
  const handleDragStart = useCallback(() => {
    preChangeRef.current = { ...useAudioStore.getState().effects };
  }, []);

  const handleDragEnd = useCallback((changed: boolean) => {
    if (changed && preChangeRef.current) {
      pushEffectsUndo(preChangeRef.current);
    }
    preChangeRef.current = null;
  }, []);

  // Discrete changes (keyboard / double-click): push current state before change
  const handleChangeStart = useCallback(() => {
    pushEffectsUndo({ ...useAudioStore.getState().effects });
  }, []);

  return (
    <Knob
      label={label}
      defaultValue={defaultValue}
      value={effectValue}
      min={min}
      max={max}
      onChange={handleChange}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onChangeStart={handleChangeStart}
      formatValue={formatValue}
    />
  );
}
