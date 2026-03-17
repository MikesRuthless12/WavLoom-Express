import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight, Music, Trash2 } from 'lucide-react';
import { loadAudioFile } from '../../../audio/load-audio-file';

interface RecentFile {
  id: number;
  file_path: string;
  file_name: string;
  file_type: string;
  accessed_at: string;
}

export default function RecentFiles() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    const rows = (await window.electronAPI.getRecentFiles()) as RecentFile[];
    setFiles(rows);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for new loads by polling on focus (lightweight)
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const handleClick = async (filePath: string) => {
    await loadAudioFile(filePath);
    refresh();
  };

  const handleClear = async () => {
    await window.electronAPI.clearRecentFiles();
    setFiles([]);
  };

  if (files.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 flex items-center gap-1.5 px-4 py-1.5 text-left text-xs font-semibold text-text-muted hover:text-text transition-colors"
          aria-label={collapsed ? t('recentFiles.expand') : t('recentFiles.collapse')}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          />
          <Clock size={12} className="shrink-0" />
          {t('recentFiles.title')}
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={handleClear}
            className="mr-3 p-1 rounded text-text-muted hover:text-error transition-colors"
            aria-label={t('recentFiles.clear')}
            title={t('recentFiles.clear')}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {!collapsed && (
        <div>
          {files.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => handleClick(file.file_path)}
              className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs text-text-secondary hover:bg-surface-elevated hover:text-text rounded-sm transition-colors"
              style={{ paddingLeft: '20px' }}
              title={file.file_path}
            >
              <Music size={14} className="shrink-0 text-text-muted" />
              <span className="truncate">{file.file_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
