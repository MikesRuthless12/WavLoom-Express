import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, X } from 'lucide-react';
import Modal from '../../ui/Modal';

interface Shortcut {
  keys: string[];
  descriptionKey: string;
}

const SHORTCUT_GROUPS: { titleKey: string; shortcuts: Shortcut[] }[] = [
  {
    titleKey: 'shortcuts.groupPlayback',
    shortcuts: [
      { keys: ['Space'], descriptionKey: 'shortcuts.playPause' },
      { keys: ['Ctrl', 'O'], descriptionKey: 'shortcuts.openFile' },
      { keys: ['Ctrl', 'E'], descriptionKey: 'shortcuts.export' },
    ],
  },
  {
    titleKey: 'shortcuts.groupEditing',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], descriptionKey: 'shortcuts.undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], descriptionKey: 'shortcuts.redo' },
    ],
  },
  {
    titleKey: 'shortcuts.groupGeneral',
    shortcuts: [
      { keys: ['Esc'], descriptionKey: 'shortcuts.closeDialog' },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded bg-surface border border-border text-[10px] font-mono font-semibold text-text-secondary shadow-[0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.3)]">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modLabel = isMac ? '\u2318' : 'Ctrl';

  const renderKeys = (keys: string[]) =>
    keys.map((key, i) => (
      <span key={i} className="inline-flex items-center">
        {i > 0 && <span className="text-text-muted mx-0.5 text-[10px]">+</span>}
        <Kbd>{key === 'Ctrl' ? modLabel : key}</Kbd>
      </span>
    ));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
        aria-label={t('shortcuts.aria')}
      >
        <Keyboard size={14} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} aria-label={t('shortcuts.title')} className="max-w-[420px]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-text">{t('shortcuts.title')}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-text-secondary hover:text-text transition-colors"
            aria-label={t('shortcuts.close')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.descriptionKey}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-surface-elevated transition-colors"
                  >
                    <span className="text-xs text-text-secondary">{t(shortcut.descriptionKey)}</span>
                    <div className="flex items-center gap-0.5 ml-4 shrink-0">
                      {renderKeys(shortcut.keys)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
