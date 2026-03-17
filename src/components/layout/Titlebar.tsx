import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Square, Copy, X } from 'lucide-react';
import SettingsPanel from '../features/settings/SettingsPanel';
import WhatsNew from '../features/changelog/WhatsNew';
import KeyboardShortcuts from '../features/shortcuts/KeyboardShortcuts';

export default function Titlebar() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI.isMaximized().then(setMaximized);
    const cleanup = window.electronAPI.onMaximizedChange(setMaximized);
    return cleanup;
  }, []);

  return (
    <div className="flex flex-col select-none titlebar-drag" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center justify-between h-9 px-3">
        <div className="w-20" />
        <h1
          onDoubleClick={() => window.electronAPI.maximizeWindow()}
          className="text-lg text-text tracking-wider titlebar-title cursor-default"
          style={{ WebkitAppRegion: 'no-drag', fontFamily: "'Rubik Spray Paint', cursive" } as React.CSSProperties}
        >
          {t('app.title')}
        </h1>
        <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <KeyboardShortcuts />
          <WhatsNew />
          <SettingsPanel />
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => window.electronAPI.minimizeWindow()}
            className="flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors "
            aria-label={t('titlebar.minimize')}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.electronAPI.maximizeWindow()}
            className="flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors "
            aria-label={maximized ? t('titlebar.restore') : t('titlebar.maximize')}
          >
            {maximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
          <button
            onClick={() => window.electronAPI.closeWindow()}
            className="flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-red-400 hover:bg-surface-elevated transition-colors "
            aria-label={t('titlebar.close')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="h-px bg-border" />
    </div>
  );
}
