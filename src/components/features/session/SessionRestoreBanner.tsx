import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, X } from 'lucide-react';
import { useAudioStore, type EffectsState } from '../../../store/audio-store';
import { loadAudioFile } from '../../../audio/load-audio-file';

interface SavedDesign {
  id: number;
  name: string;
  source_type: string;
  source_id: number;
  effects_state: string;
  mode: string;
  updated_at: string;
}

async function resolveFilePath(design: SavedDesign): Promise<string | null> {
  if (design.source_type === 'analysis') {
    const row = (await window.electronAPI.getAnalysisById(design.source_id)) as {
      source_file_path: string;
    } | null;
    return row?.source_file_path ?? null;
  }
  if (design.source_type === 'preset') {
    const row = (await window.electronAPI.getPreset(design.source_id)) as {
      file_path: string | null;
    } | null;
    return row?.file_path ?? null;
  }
  return null;
}

export default function SessionRestoreBanner() {
  const { t } = useTranslation();
  const [design, setDesign] = useState<SavedDesign | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      const last = (await window.electronAPI.getLastDesign()) as SavedDesign | null;
      if (last) setDesign(last);
    })();
  }, []);

  const handleResume = useCallback(async () => {
    if (!design) return;
    setDismissed(true);

    // Resolve the audio file path from the source
    const filePath = await resolveFilePath(design);
    if (!filePath) return;

    // Load the audio file first (this sets up buffer + analysis)
    await loadAudioFile(filePath);

    const store = useAudioStore.getState();

    // Restore effects (overwrite what loadAudioFile/preset might have set)
    try {
      const effects = JSON.parse(design.effects_state) as EffectsState;
      for (const [key, value] of Object.entries(effects)) {
        store.setEffect(key as keyof EffectsState, value as number);
      }
    } catch {
      // Ignore malformed effects
    }

    // Restore mode and source tracking
    store.setMode(design.mode as 'realistic' | 'edm');
    store.setSource(
      design.source_type as 'analysis' | 'preset',
      design.source_id,
    );
    store.setCurrentDesignId(design.id);
  }, [design]);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  if (!design || dismissed) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-surface-elevated border border-border shadow-lg">
      <RotateCcw size={14} className="shrink-0 text-primary" />
      <span className="text-xs text-text">
        {t('session.resume')}
        <span className="ml-1.5 text-text-muted">({design.name})</span>
      </span>
      <button
        type="button"
        onClick={handleResume}
        className="px-2.5 py-1 rounded text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
        aria-label={t('session.resumeAria')}
      >
        {t('session.resumeBtn')}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="px-2.5 py-1 rounded text-xs font-semibold text-text-muted hover:text-text border border-border hover:border-text-muted transition-colors"
        aria-label={t('session.startFreshAria')}
      >
        {t('session.startFresh')}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-1 text-text-muted hover:text-text transition-colors"
        aria-label={t('session.dismiss')}
      >
        <X size={12} />
      </button>
    </div>
  );
}
