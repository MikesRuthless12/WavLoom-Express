import MainLayout from './components/layout/MainLayout';
import SessionRestoreBanner from './components/features/session/SessionRestoreBanner';
import { useAutoSave } from './hooks/useAutoSave';

function App() {
  useAutoSave();

  return (
    <>
      <MainLayout />
      <SessionRestoreBanner />
    </>
  );
}

export default App;
