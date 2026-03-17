import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioEngine } from '../../../audio/engine';
import Knob from '../../ui/Knob';

export default function PitchControls() {
  const { t } = useTranslation();
  const engine = AudioEngine.getInstance();

  const handleAmountChange = useCallback(
    (value: number) => {
      engine.setPitchAmount(value);
    },
    [engine],
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        {t('effects.pitch')}
      </span>
      <Knob
        label={t('effects.amount')}
        defaultValue={50}
        min={0}
        max={100}
        onChange={handleAmountChange}
      />
    </div>
  );
}
