import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, X } from 'lucide-react';
import Modal from '../../ui/Modal';
import changelogData from '../../../data/changelog.json';

const APP_VERSION = '1.0.0-alpha';
const LAST_VIEWED_KEY = 'whats_new_last_viewed';
const MAX_ENTRIES = 3;

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export default function WhatsNew() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const lastViewed = localStorage.getItem(LAST_VIEWED_KEY);
    if (lastViewed !== APP_VERSION) {
      setHasNew(true);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setHasNew(false);
    localStorage.setItem(LAST_VIEWED_KEY, APP_VERSION);
  };

  const entries: ChangelogEntry[] = (changelogData as ChangelogEntry[]).slice(0, MAX_ENTRIES);

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
        aria-label={t('whatsNew.aria')}
      >
        <BookOpen size={14} />
        {hasNew && (
          <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} aria-label={t('whatsNew.title')}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-text">{t('whatsNew.title')}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-text-secondary hover:text-text transition-colors"
            aria-label={t('whatsNew.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xs font-semibold text-primary font-mono">{entry.version}</span>
                <span className="text-[10px] text-text-muted font-mono">{entry.date}</span>
              </div>
              <ul className="space-y-1">
                {entry.changes.map((change, i) => (
                  <li key={i} className="text-xs text-text-secondary pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-text-muted">
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
