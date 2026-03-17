import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioEngine } from '../../../audio/engine';
import Knob from '../../ui/Knob';

export default function VolumeControls() {
  const { t } = useTranslation();
  const engine = AudioEngine.getInstance();

  const handleAmountChange = useCallback(
    (value: number) => {
      engine.setVolumeAmount(value);
    },
    [engine],
  );

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        {t('effects.volume')}
      </span>
      <Knob
        label={t('effects.master')}
        defaultValue={50}
        min={0}
        max={100}
        onChange={handleAmountChange}
      />
    </div>
  );
}
