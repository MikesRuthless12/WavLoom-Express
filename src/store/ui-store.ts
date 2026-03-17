import { create } from 'zustand';

type RightPanelTab = 'presets' | 'kit-builder';

interface UIState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  rightPanelActiveTab: RightPanelTab;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelVisible: true,
  rightPanelVisible: true,
  rightPanelActiveTab: 'presets',
  toggleLeftPanel: () => set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set((s) => ({ rightPanelVisible: !s.rightPanelVisible })),
  setRightPanelTab: (tab) => set({ rightPanelActiveTab: tab }),
}));
