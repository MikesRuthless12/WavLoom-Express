import { useState, useEffect, useCallback } from 'react';
import type { DirectoryEntry } from '../types/electron';

interface FileExplorerState {
  rootDir: string | null;
  entries: DirectoryEntry[];
  expandedDirs: Set<string>;
  childrenMap: Map<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
}

export function useFileExplorer() {
  const [state, setState] = useState<FileExplorerState>({
    rootDir: null,
    entries: [],
    expandedDirs: new Set(),
    childrenMap: new Map(),
    loading: false,
    error: null,
  });

  const loadDirectory = useCallback(async (dirPath: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const all = await window.electronAPI.readDirectory(dirPath);
      const filtered = all
        .filter((e) => e.isDirectory || e.isAudio)
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setState((s) => ({
        ...s,
        rootDir: dirPath,
        entries: filtered,
        expandedDirs: new Set(),
        childrenMap: new Map(),
        loading: false,
      }));
      await window.electronAPI.setSetting('lastOpenedDir', dirPath);
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Failed to read directory.' }));
    }
  }, []);

  const toggleDir = useCallback(async (dirPath: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedDirs);
      if (next.has(dirPath)) {
        next.delete(dirPath);
        return { ...prev, expandedDirs: next };
      }
      next.add(dirPath);
      return { ...prev, expandedDirs: next };
    });

    // Load children if not cached
    setState((prev) => {
      if (prev.childrenMap.has(dirPath)) return prev;
      return prev; // will load below
    });

    // Fetch children
    try {
      const all = await window.electronAPI.readDirectory(dirPath);
      const filtered = all
        .filter((e) => e.isDirectory || e.isAudio)
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      setState((prev) => {
        const map = new Map(prev.childrenMap);
        map.set(dirPath, filtered);
        return { ...prev, childrenMap: map };
      });
    } catch {
      // silently ignore unreadable directories
    }
  }, []);

  const browse = useCallback(async () => {
    const dirPath = await window.electronAPI.openDirectory();
    if (dirPath) {
      await loadDirectory(dirPath);
    }
  }, [loadDirectory]);

  // Load last-opened directory on mount
  useEffect(() => {
    (async () => {
      const last = await window.electronAPI.getSetting('lastOpenedDir');
      if (last) {
        await loadDirectory(last);
      }
    })();
  }, [loadDirectory]);

  return {
    rootDir: state.rootDir,
    entries: state.entries,
    expandedDirs: state.expandedDirs,
    childrenMap: state.childrenMap,
    loading: state.loading,
    error: state.error,
    browse,
    toggleDir,
  };
}
