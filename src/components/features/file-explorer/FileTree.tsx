import { useCallback, useEffect, useRef, useMemo, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FolderOpen, Music, ChevronRight } from 'lucide-react';
import type { DirectoryEntry } from '../../../types/electron';

interface FileTreeProps {
  entries: DirectoryEntry[];
  expandedDirs: Set<string>;
  childrenMap: Map<string, DirectoryEntry[]>;
  onToggleDir: (dirPath: string) => void;
  onSelectFile: (filePath: string) => void;
  onSelectFileReversed: (filePath: string) => void;
  selectedPath: string | null;
  onSelectedPathChange: (path: string) => void;
  depth?: number;
  isRoot?: boolean;
}

/** Flatten the visible tree into a linear list for keyboard navigation */
function flattenVisible(
  entries: DirectoryEntry[],
  expandedDirs: Set<string>,
  childrenMap: Map<string, DirectoryEntry[]>,
): DirectoryEntry[] {
  const result: DirectoryEntry[] = [];
  for (const entry of entries) {
    result.push(entry);
    if (entry.isDirectory && expandedDirs.has(entry.path)) {
      const children = childrenMap.get(entry.path);
      if (children) {
        result.push(...flattenVisible(children, expandedDirs, childrenMap));
      }
    }
  }
  return result;
}

export default function FileTree({
  entries,
  expandedDirs,
  childrenMap,
  onToggleDir,
  onSelectFile,
  onSelectFileReversed,
  selectedPath,
  onSelectedPathChange,
  depth = 0,
  isRoot = true,
}: FileTreeProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const flatList = useMemo(
    () => (isRoot ? flattenVisible(entries, expandedDirs, childrenMap) : []),
    [isRoot, entries, expandedDirs, childrenMap],
  );

  const handleDragStart = useCallback((e: DragEvent, entry: DirectoryEntry) => {
    if (entry.isDirectory) return;
    e.dataTransfer.setData(
      'application/wavloom-sound',
      JSON.stringify({ soundName: entry.name, filePath: entry.path }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Keep selection valid: auto-select first item if nothing selected,
  // or move to nearest visible ancestor if selected item is no longer visible
  useEffect(() => {
    if (!isRoot || flatList.length === 0) return;

    // Nothing selected yet — select first item
    if (!selectedPath) {
      onSelectedPathChange(flatList[0].path);
      return;
    }

    // Selection is still visible — nothing to do
    if (flatList.some((e) => e.path === selectedPath)) return;

    // Selected item disappeared (parent collapsed) — find nearest visible ancestor
    for (let i = selectedPath.length; i > 0; i--) {
      const ch = selectedPath[i - 1];
      if (ch === '/' || ch === '\\') {
        const parent = selectedPath.substring(0, i - 1);
        const match = flatList.find((e) => e.path === parent);
        if (match) {
          onSelectedPathChange(match.path);
          return;
        }
      }
    }
    // Fallback: select first item
    onSelectedPathChange(flatList[0].path);
  }, [isRoot, flatList, selectedPath, onSelectedPathChange]);

  // Keyboard navigation (only on root)
  useEffect(() => {
    if (!isRoot) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Space from triggering click on focused button — let global play/pause handle it
      if (e.code === 'Space') {
        e.preventDefault();
        return;
      }

      if (flatList.length === 0) return;
      const currentIdx = flatList.findIndex((en) => en.path === selectedPath);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIdx < flatList.length - 1) {
          onSelectedPathChange(flatList[currentIdx + 1].path);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIdx > 0) {
          onSelectedPathChange(flatList[currentIdx - 1].path);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIdx < 0) return;
        const entry = flatList[currentIdx];
        if (entry.isDirectory) {
          // Toggle: open if closed, close if open
          onToggleDir(entry.path);
        } else {
          onSelectFile(entry.path);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIdx < 0) return;
        const entry = flatList[currentIdx];
        if (entry.isDirectory && expandedDirs.has(entry.path)) {
          onToggleDir(entry.path);
        } else if (!entry.isDirectory) {
          onSelectFileReversed(entry.path);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentIdx < 0) return;
        const entry = flatList[currentIdx];
        if (entry.isDirectory) {
          onToggleDir(entry.path);
        } else {
          onSelectFile(entry.path);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isRoot, flatList, selectedPath, expandedDirs, onToggleDir, onSelectFile, onSelectFileReversed, onSelectedPathChange]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isRoot || !selectedPath) return;
    const el = containerRef.current?.querySelector(`[data-path="${CSS.escape(selectedPath)}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [isRoot, selectedPath]);

  return (
    <div
      ref={isRoot ? containerRef : undefined}
      role={isRoot ? 'tree' : 'group'}
      aria-label={isRoot ? t('fileExplorer.fileBrowser') : undefined}
      tabIndex={isRoot ? 0 : undefined}
      className={isRoot ? 'outline-none' : undefined}
    >
      {entries.map((entry) => {
        const isExpanded = expandedDirs.has(entry.path);
        const children = childrenMap.get(entry.path);
        const isSelected = selectedPath === entry.path;

        return (
          <div key={entry.path} role="treeitem" aria-expanded={entry.isDirectory ? isExpanded : undefined}>
            <button
              type="button"
              data-path={entry.path}
              onClick={() => {
                onSelectedPathChange(entry.path);
                if (entry.isDirectory) {
                  onToggleDir(entry.path);
                } else {
                  onSelectFile(entry.path);
                }
              }}
              draggable={!entry.isDirectory}
              onDragStart={(e) => handleDragStart(e, entry)}
              className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs rounded-sm transition-colors border outline-none ${
                isSelected
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-transparent text-text-secondary hover:bg-surface-elevated hover:text-text'
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              title={entry.name}
              aria-label={entry.isDirectory ? t('fileExplorer.folderAria', { name: entry.name }) : t('fileExplorer.openFileAria', { name: entry.name })}
            >
              {entry.isDirectory ? (
                <>
                  <ChevronRight
                    size={12}
                    className={`shrink-0 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  {isExpanded ? (
                    <FolderOpen size={14} className="shrink-0 text-primary" />
                  ) : (
                    <Folder size={14} className="shrink-0 text-primary" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-3 shrink-0" />
                  <Music size={14} className="shrink-0 text-text-muted" />
                </>
              )}
              <span className="truncate">{entry.name}</span>
            </button>

            {entry.isDirectory && isExpanded && children && (
              <FileTree
                entries={children}
                expandedDirs={expandedDirs}
                childrenMap={childrenMap}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onSelectFileReversed={onSelectFileReversed}
                selectedPath={selectedPath}
                onSelectedPathChange={onSelectedPathChange}
                depth={depth + 1}
                isRoot={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
