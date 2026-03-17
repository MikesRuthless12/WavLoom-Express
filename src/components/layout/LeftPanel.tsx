import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { useUIStore } from '../../store/ui-store';
import Panel from '../ui/Panel';
import FileExplorer from '../features/file-explorer/FileExplorer';

export default function LeftPanel() {
  const { t } = useTranslation();
  const visible = useUIStore((s) => s.leftPanelVisible);
  const toggle = useUIStore((s) => s.toggleLeftPanel);

  return (
    <Panel className="relative border-r border-border" aria-label={t('leftPanel.fileBrowser')}>
      <button
        onClick={toggle}
        className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-sm text-text-muted hover:text-text transition-colors"
        aria-label={visible ? t('leftPanel.collapse') : t('leftPanel.expand')}
      >
        <ChevronLeft
          size={14}
          className={`transition-transform ${!visible ? 'rotate-180' : ''}`}
        />
      </button>

      {visible && (
        <div className="flex flex-col h-full">
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
              {t('leftPanel.browser')}
            </h2>
          </div>
          <div className="flex-1 min-h-0">
            <FileExplorer />
          </div>
        </div>
      )}
    </Panel>
  );
}
