import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';

export default function ABComparison() {
  const { t } = useTranslation();
  const { abActive, abMode, setABActive, setABMode } = useAudioStore();
  const engine = AudioEngine.getInstance();

  const toggleActive = useCallback(() => {
    const next = !abActive;
    setABActive(next);
    engine.setABActive(next);
    if (!next) setABMode(false);
  }, [abActive, setABActive, setABMode, engine]);

  const toggleMode = useCallback(() => {
    const next = !abMode;
    setABMode(next);
    engine.setABMode(next);
  }, [abMode, setABMode, engine]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggleActive}
        className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-colors ${
          abActive
            ? 'border-primary bg-primary-muted text-primary'
            : 'border-border bg-surface text-text-muted hover:border-text-muted'
        }`}
        title={t('ab.toggle')}
        aria-label={t('ab.toggle')}
        aria-pressed={abActive}
      >
        A/B
      </button>
      {abActive && (
        <button
          onClick={toggleMode}
          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition-colors ${
            abMode
              ? 'border-blue-500 bg-blue-500/10 text-blue-400'
              : 'border-primary bg-primary-muted text-primary'
          }`}
          title={abMode ? t('ab.listeningOriginal') : t('ab.listeningProcessed')}
          aria-label={abMode ? t('ab.switchToProcessed') : t('ab.switchToOriginal')}
        >
          {abMode ? 'B' : 'A'}
        </button>
      )}
    </div>
  );
}
