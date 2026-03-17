import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/ui-store';
import Panel from '../ui/Panel';
import PresetBrowser from '../features/preset-library/PresetBrowser';
import KitBuilder from '../features/kit-builder/KitBuilder';

export default function RightPanel() {
  const { t } = useTranslation();
  const activeTab = useUIStore((s) => s.rightPanelActiveTab);
  const setTab = useUIStore((s) => s.setRightPanelTab);

  return (
    <Panel className="border-l border-border flex flex-col" aria-label={t('rightPanel.presetsAndKit')}>
      <div className="flex gap-2 p-3 border-b border-border" role="tablist" aria-label={t('rightPanel.tabs')}>
        <TabButton
          active={activeTab === 'presets'}
          onClick={() => setTab('presets')}
        >
          {t('rightPanel.presets')}
        </TabButton>
        <TabButton
          active={activeTab === 'kit-builder'}
          onClick={() => setTab('kit-builder')}
        >
          {t('rightPanel.kitBuilder')}
        </TabButton>
      </div>

      <div className="flex-1 p-4">
        {activeTab === 'presets' && <PresetBrowser />}
        {activeTab === 'kit-builder' && <KitBuilder />}
      </div>
    </Panel>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-colors ${
        active
          ? 'border-primary text-primary bg-primary-muted'
          : 'border-border text-text-secondary bg-transparent hover:text-text hover:border-text-muted'
      }`}
    >
      {children}
    </button>
  );
}
