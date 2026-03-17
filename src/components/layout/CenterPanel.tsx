import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAudioStore } from '../../store/audio-store';
import { loadAudioFile } from '../../audio/load-audio-file';
import { AudioEngine } from '../../audio/engine';
import { exportToTempWav } from '../../audio/exporter';
import type { AudioMode } from '../../audio/modes';
import WaveformDisplay from '../features/waveform/WaveformDisplay';
import type { WaveformDisplayHandle } from '../features/waveform/WaveformDisplay';
import ABComparison from '../features/waveform/ABComparison';
import EffectsRack from '../features/effects/EffectsRack';
import ExportDialog from '../features/export/ExportDialog';
import SavePresetDialog from '../features/preset-library/SavePresetDialog';
import Toggle from '../ui/Toggle';
import { Download, Plus, Save } from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useKitStore } from '../../store/kit-store';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSampleRate(hz: number): string {
  return `${(hz / 1000).toFixed(1)} kHz`;
}

function formatInstrumentType(type: string, t: (key: string) => string): string {
  if (type === 'hi-hat') return t('main.instrumentHiHat');
  if (type === 'unknown') return t('main.instrumentUnknown');
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function CenterPanel() {
  const { t } = useTranslation();
  const { fileName, isLoading, error, currentBuffer, analysis, duration, sampleRate, mode, setMode } = useAudioStore();
  const [dragOver, setDragOver] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const waveformRef = useRef<WaveformDisplayHandle>(null);

  const handleToggleExport = useCallback(() => {
    setShowExportDialog((prev) => !prev);
  }, []);

  const handleCloseExport = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  const handleOpenFile = useCallback(async () => {
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
      loadAudioFile(filePath);
    }
  }, []);

  useKeyboardShortcuts({
    onPlayPause: useCallback(() => waveformRef.current?.togglePlayPause(), []),
    onExport: handleToggleExport,
    onOpenFile: handleOpenFile,
    onEscape: handleCloseExport,
  });

  const handleModeToggle = useCallback((checked: boolean) => {
    const newMode: AudioMode = checked ? 'edm' : 'realistic';
    setMode(newMode);
    AudioEngine.getInstance().setMode(newMode);
  }, [setMode]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.flac'];

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        useAudioStore.getState().setError(t('main.unsupportedFormat'));
        return;
      }
      const filePath = window.electronAPI.getPathForFile(file);
      if (filePath) {
        loadAudioFile(filePath);
      }
    }
  }, []);

  const addSoundToSlot = useKitStore((s) => s.addSoundToSlot);
  const kitSlots = useKitStore((s) => s.slots);
  const hasSoundWithPath = useKitStore((s) => s.hasSoundWithPath);

  // Pre-export temp WAV on mousedown so it's ready by dragstart
  const tempPathRef = useRef<string | null>(null);

  const handleWaveformMouseDown = useCallback(() => {
    if (!currentBuffer || !fileName) return;
    tempPathRef.current = null;
    exportToTempWav(fileName)
      .then((p) => { tempPathRef.current = p; })
      .catch(() => {});
  }, [currentBuffer, fileName]);

  const handleWaveformDragStart = useCallback((e: DragEvent) => {
    if (!currentBuffer || !fileName) return;

    if (tempPathRef.current) {
      // Temp WAV ready — use OS-level drag for DAW drops
      // Must preventDefault to hand off drag to the OS via startDrag
      e.preventDefault();
      window.electronAPI.startDrag(tempPathRef.current);
    } else {
      // Temp WAV not ready yet — fall back to internal HTML5 drag for kit slots
      const filePath = useAudioStore.getState().filePath;
      e.dataTransfer.setData(
        'application/wavloom-sound',
        JSON.stringify({ soundName: fileName, filePath }),
      );
      e.dataTransfer.effectAllowed = 'copy';
    }
  }, [currentBuffer, fileName]);

  const handleAddToKit = useCallback(() => {
    if (!currentBuffer || !fileName) return;
    const filePath = useAudioStore.getState().filePath;
    // Reject duplicates
    if (hasSoundWithPath(filePath)) return;
    const emptyIndex = kitSlots.findIndex((s) => s.soundName === null);
    if (emptyIndex !== -1) {
      addSoundToSlot(emptyIndex, fileName, filePath);
    }
  }, [currentBuffer, fileName, kitSlots, addSoundToSlot, hasSoundWithPath]);

  const hasAudio = !!currentBuffer;

  return (
    <div
      className="h-full flex flex-col bg-bg"
      role="main"
      aria-label={t('main.audioWorkspace')}
      style={dragOver ? { outline: '2px dashed #39FF14', outlineOffset: '-2px' } : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isLoading && (
        <div className="flex-1 flex items-center justify-center" role="status" aria-live="polite">
          <div className="text-center">
            <div
              className="mx-auto mb-3 rounded-lg"
              style={{
                width: 200,
                height: 48,
                animation: 'analyzePulse 1.2s ease-in-out infinite',
                background: '#39FF14',
              }}
            />
            <p className="text-sm font-medium" style={{ color: '#39FF14' }}>
              {t('main.analyzing')}
            </p>
          </div>
        </div>
      )}

      {hasAudio && !isLoading && !error && (
        <div className="flex-1 flex flex-col fade-in">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <p className="text-xs text-text-muted truncate">{fileName}</p>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <ABComparison />
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => setShowSavePresetDialog(true)}
                className="flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-surface hover:border-primary hover:text-primary text-text-muted transition-colors"
                title={t('main.savePreset')}
                aria-label={t('main.savePreset')}
              >
                <Save size={14} />
              </button>
              <button
                onClick={() => setShowExportDialog(true)}
                className="flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-surface hover:border-primary hover:text-primary text-text-muted transition-colors"
                title={t('main.exportAudio')}
                aria-label={t('main.exportAudio')}
              >
                <Download size={14} />
              </button>
              <button
                onClick={handleAddToKit}
                className="flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-surface hover:border-primary hover:text-primary text-text-muted transition-colors"
                title={t('main.addToKit')}
                aria-label={t('main.addToKit')}
              >
                <Plus size={14} />
              </button>
              <div className="w-px h-4 bg-border" />
              <span className={`text-xs font-mono ${mode === 'realistic' ? 'text-text' : 'text-text-muted'}`}>
                {t('main.realistic')}
              </span>
              <Toggle checked={mode === 'edm'} onChange={handleModeToggle} label={t('main.toggleEdm')} />
              <span className={`text-xs font-mono ${mode === 'edm' ? 'text-primary' : 'text-text-muted'}`}>
                {t('main.edm')}
              </span>
            </div>
          </div>
          <div className="flex-1 px-4 pb-2 min-h-0">
            <WaveformDisplay ref={waveformRef} onDragStart={handleWaveformDragStart} onMouseDown={handleWaveformMouseDown} />
          </div>

          {/* Inline error area */}
          {error && (
            <div className="px-4 pb-1">
              <p className="text-xs font-mono text-error">{error}</p>
            </div>
          )}

          {/* Analysis metadata */}
          {analysis && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-4 text-xs font-mono text-text-secondary">
                <span>{formatInstrumentType(analysis.instrumentType, t)}</span>
                <span className="text-text-muted">|</span>
                <span>{formatDuration(duration)}</span>
                <span className="text-text-muted">|</span>
                <span>{formatSampleRate(sampleRate)}</span>
                <span className="text-text-muted">|</span>
                <span className="truncate text-text-muted">{fileName}</span>
              </div>
            </div>
          )}

          <EffectsRack disabled={false} />
        </div>
      )}

      {!hasAudio && !isLoading && (
        <div className="flex-1 flex items-center justify-center fade-in">
          <div className="text-center">
            {error ? (
              <p className="text-sm font-mono text-error">{error}</p>
            ) : (
              <>
                <div className="mb-4">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto opacity-30"
                  >
                    <rect x="4" y="20" width="4" height="8" rx="1" fill="currentColor" className="text-primary" />
                    <rect x="12" y="14" width="4" height="20" rx="1" fill="currentColor" className="text-primary" />
                    <rect x="20" y="8" width="4" height="32" rx="1" fill="currentColor" className="text-primary" />
                    <rect x="28" y="12" width="4" height="24" rx="1" fill="currentColor" className="text-primary" />
                    <rect x="36" y="16" width="4" height="16" rx="1" fill="currentColor" className="text-primary" />
                    <rect x="44" y="22" width="0" height="4" rx="1" fill="currentColor" className="text-primary" />
                  </svg>
                </div>
                <p className="text-sm text-text-muted">
                  {t('main.dropFile')}
                </p>
                <button
                  type="button"
                  onClick={handleOpenFile}
                  className="mt-3 text-xs text-text-muted hover:text-text-secondary underline"
                  aria-label={t('main.browseFilesAria')}
                >
                  {t('main.browseFiles')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Effects rack disabled state when no audio */}
      {!hasAudio && !isLoading && (
        <EffectsRack disabled={true} />
      )}

      <ExportDialog open={showExportDialog} onClose={() => setShowExportDialog(false)} />
      <SavePresetDialog open={showSavePresetDialog} onClose={() => setShowSavePresetDialog(false)} />
    </div>
  );
}
