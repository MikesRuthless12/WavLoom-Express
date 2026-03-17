import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioEngine } from '../../../audio/engine';
import type { ReverbType } from '../../../audio/effects/reverb';
import Knob from '../../ui/Knob';

const REVERB_TYPES: { value: ReverbType; labelKey: string }[] = [
  { value: 'small-room', labelKey: 'effects.reverbTypeRoom' },
  { value: 'large-hall', labelKey: 'effects.reverbTypeHall' },
  { value: 'plate', labelKey: 'effects.reverbTypePlate' },
];

export default function ReverbControls() {
  const { t } = useTranslation();
  const engine = AudioEngine.getInstance();
  const [activeType, setActiveType] = useState<ReverbType>('small-room');

  const handleAmountChange = useCallback(
    (value: number) => {
      engine.setReverbAmount(value);
    },
    [engine],
  );

  const handleTypeChange = useCallback(
    (type: ReverbType) => {
      setActiveType(type);
      engine.setReverbType(type);
    },
    [engine],
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        {t('effects.reverb')}
      </span>
      <div className="flex gap-1">
        {REVERB_TYPES.map(({ value, labelKey }) => {
          const label = t(labelKey);
          return (
            <button
              key={value}
              onClick={() => handleTypeChange(value)}
              className={`px-2 py-1 text-[10px] font-medium rounded-sm border transition-colors ${
                activeType === value
                  ? 'border-primary text-primary bg-primary-muted'
                  : 'border-border text-text-muted bg-transparent hover:text-text-secondary hover:border-text-muted'
              }`}
              aria-label={t('effects.reverbTypeAria', { label })}
              aria-pressed={activeType === value}
            >
              {label}
            </button>
          );
        })}
      </div>
      <Knob
        label={t('effects.amount')}
        defaultValue={0}
        min={0}
        max={100}
        onChange={handleAmountChange}
      />
    </div>
  );
}
