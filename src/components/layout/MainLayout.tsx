import { useUIStore } from '../../store/ui-store';
import Titlebar from './Titlebar';
import LeftPanel from './LeftPanel';
import CenterPanel from './CenterPanel';
import RightPanel from './RightPanel';

export default function MainLayout() {
  const leftVisible = useUIStore((s) => s.leftPanelVisible);
  const rightVisible = useUIStore((s) => s.rightPanelVisible);

  const leftCol = leftVisible ? '240px' : '48px';
  const rightCol = rightVisible ? '280px' : '0px';

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <Titlebar />
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: `${leftCol} minmax(0, 1fr) ${rightCol}`,
        }}
      >
        <LeftPanel />
        <CenterPanel />
        {rightVisible && <RightPanel />}
      </div>
    </div>
  );
}
