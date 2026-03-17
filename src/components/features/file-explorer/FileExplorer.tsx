import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderSearch, FolderOpen } from 'lucide-react';
import { useFileExplorer } from '../../../hooks/useFileExplorer';
import { loadAudioFile } from '../../../audio/load-audio-file';
import { useAudioStore } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';
import FileTree from './FileTree';
import RecentFiles from './RecentFiles';

export default function FileExplorer() {
  const { t } = useTranslation();
  const {
    rootDir,
    entries,
    expandedDirs,
    childrenMap,
    loading,
    error,
    browse,
    toggleDir,
  } = useFileExplorer();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleSelectFile = useCallback((filePath: string) => {
    loadAudioFile(filePath);
  }, []);

  const handleSelectFileReversed = useCallback(async (filePath: string) => {
    await loadAudioFile(filePath);
    // After loading, reverse the buffer and mark as reversed
    const engine = AudioEngine.getInstance();
    engine.reverseBuffer();
    useAudioStore.getState().setReversed(true);
  }, []);

  // Extract folder name from rootDir path
  const rootDirName = rootDir ? rootDir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? rootDir : null;

  return (
    <div className="flex flex-col h-full">
      <button
        type="button"
        onClick={browse}
        className="mx-4 mb-3 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-elevated border border-border text-text hover:border-primary hover:text-primary transition-colors"
        aria-label={t('fileExplorer.browseAria')}
      >
        <FolderSearch size={14} />
        {t('fileExplorer.browseBtn')}
      </button>

      <RecentFiles />

      {loading && (
        <div className="px-4 flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="skeleton w-4 h-4 shrink-0" />
              <div className="skeleton h-3 flex-1" style={{ maxWidth: `${60 + i * 8}%` }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="px-4 text-xs text-red-400">{error}</p>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="px-4 text-xs text-text-muted">
          {rootDir ? t('fileExplorer.noFiles') : t('fileExplorer.selectFolder')}
        </p>
      )}

      {!loading && entries.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0 fade-in">
          {/* Parent folder header */}
          {rootDirName && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-0.5">
              <FolderOpen size={14} className="shrink-0 text-primary" />
              <span className="text-xs font-semibold text-text truncate" title={rootDir ?? undefined}>
                {rootDirName}
              </span>
            </div>
          )}
          <FileTree
            entries={entries}
            expandedDirs={expandedDirs}
            childrenMap={childrenMap}
            onToggleDir={toggleDir}
            onSelectFile={handleSelectFile}
            onSelectFileReversed={handleSelectFileReversed}
            selectedPath={selectedPath}
            onSelectedPathChange={setSelectedPath}
          />
        </div>
      )}
    </div>
  );
}
