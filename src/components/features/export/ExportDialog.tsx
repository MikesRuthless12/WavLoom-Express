import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useAudioStore } from '../../../store/audio-store';
import { exportAudio, type ExportFormat, type WavBitDepth, type Mp3Bitrate, type FlacBitDepth, type AiffBitDepth } from '../../../audio/exporter';

type ExportState = 'idle' | 'exporting' | 'done' | 'error';

const WAV_BIT_DEPTHS: { value: WavBitDepth; label: string }[] = [
  { value: 16, label: '16-bit' },
  { value: 24, label: '24-bit' },
  { value: 32, label: '32-bit float' },
];

const MP3_BITRATES: { value: Mp3Bitrate; label: string }[] = [
  { value: 128, label: '128 kbps' },
  { value: 192, label: '192 kbps' },
  { value: 256, label: '256 kbps' },
  { value: 320, label: '320 kbps' },
];

const FLAC_BIT_DEPTHS: { value: FlacBitDepth; label: string }[] = [
  { value: 16, label: '16-bit' },
  { value: 24, label: '24-bit' },
];

const AIFF_BIT_DEPTHS: { value: AiffBitDepth; label: string }[] = [
  { value: 16, label: '16-bit' },
  { value: 24, label: '24-bit' },
];

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { t } = useTranslation();
  const fileName = useAudioStore((s) => s.fileName);
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [wavBitDepth, setWavBitDepth] = useState<WavBitDepth>(16);
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3Bitrate>(320);
  const [flacBitDepth, setFlacBitDepth] = useState<FlacBitDepth>(16);
  const [aiffBitDepth, setAiffBitDepth] = useState<AiffBitDepth>(16);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [exportedPath, setExportedPath] = useState('');

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setExportState('idle');
    setErrorMsg('');
    setExportedPath('');
  }, [open]);

  const handleExport = useCallback(async () => {
    setErrorMsg('');

    // Build default filename from loaded audio file
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'export';
    const extMap: Record<ExportFormat, string> = { wav: '.wav', mp3: '.mp3', flac: '.flac', aiff: '.aiff' };
    const defaultName = `${baseName}${extMap[format]}`;

    // Show native Save dialog — handles OS filename rules, path limits, overwrite confirmation
    const filePath = await window.electronAPI.showSaveDialog(defaultName, format);
    if (!filePath) return; // User cancelled

    setExportState('exporting');
    try {
      const result = await exportAudio({
        format,
        filePath,
        wavBitDepth,
        mp3Bitrate,
        flacBitDepth,
        aiffBitDepth,
      });
      setExportedPath(result.filePath);
      setExportState('done');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setExportState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
    }
  }, [format, fileName, wavBitDepth, mp3Bitrate, flacBitDepth, aiffBitDepth, onClose]);

  const formatBtnClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-colors ${
      active
        ? 'border-primary bg-primary-muted text-primary'
        : 'border-border bg-surface text-text-muted hover:border-text-muted'
    }`;

  return (
    <Modal open={open} onClose={onClose} aria-label={t('export.title')}>
      <h2 className="text-sm font-semibold text-text mb-4">{t('export.title')}</h2>

      {/* Format selector */}
      <div className="mb-4">
        <label className="text-xs text-text-muted mb-1.5 block">{t('export.format')}</label>
        <div className="flex gap-2">
          <button className={formatBtnClass(format === 'wav')} onClick={() => setFormat('wav')} aria-label={t('export.exportAsWav')} aria-pressed={format === 'wav'}>
            {t('export.wav')}
          </button>
          <button className={formatBtnClass(format === 'mp3')} onClick={() => setFormat('mp3')} aria-label={t('export.exportAsMp3')} aria-pressed={format === 'mp3'}>
            {t('export.mp3')}
          </button>
          <button className={formatBtnClass(format === 'flac')} onClick={() => setFormat('flac')} aria-label={t('export.exportAsFlac')} aria-pressed={format === 'flac'}>
            {t('export.flac')}
          </button>
          <button className={formatBtnClass(format === 'aiff')} onClick={() => setFormat('aiff')} aria-label={t('export.exportAsAiff')} aria-pressed={format === 'aiff'}>
            {t('export.aiff')}
          </button>
        </div>
      </div>

      {/* Quality selector */}
      <div className="mb-4">
        <label className="text-xs text-text-muted mb-1.5 block">
          {format === 'mp3' ? t('export.bitrate') : t('export.bitDepth')}
        </label>
        <div className="flex gap-2 flex-wrap">
          {format === 'wav' &&
            WAV_BIT_DEPTHS.map((opt) => (
              <button
                key={opt.value}
                className={formatBtnClass(wavBitDepth === opt.value)}
                onClick={() => setWavBitDepth(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          {format === 'mp3' &&
            MP3_BITRATES.map((opt) => (
              <button
                key={opt.value}
                className={formatBtnClass(mp3Bitrate === opt.value)}
                onClick={() => setMp3Bitrate(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          {format === 'flac' &&
            FLAC_BIT_DEPTHS.map((opt) => (
              <button
                key={opt.value}
                className={formatBtnClass(flacBitDepth === opt.value)}
                onClick={() => setFlacBitDepth(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          {format === 'aiff' &&
            AIFF_BIT_DEPTHS.map((opt) => (
              <button
                key={opt.value}
                className={formatBtnClass(aiffBitDepth === opt.value)}
                onClick={() => setAiffBitDepth(opt.value)}
              >
                {opt.label}
              </button>
            ))}
        </div>
      </div>

      {/* Exported path feedback */}
      {exportState === 'done' && exportedPath && (
        <p className="text-xs text-success mb-3 break-all">{t('export.savedTo', { path: exportedPath })}</p>
      )}

      {/* Error message */}
      {exportState === 'error' && (
        <p className="text-xs text-error mb-3">{errorMsg}</p>
      )}

      {/* Export button */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={exportState === 'exporting'}>
          {t('export.cancel')}
        </Button>
        <Button
          onClick={handleExport}
          disabled={exportState === 'exporting' || exportState === 'done'}
        >
          {exportState === 'exporting'
            ? t('export.exporting')
            : exportState === 'done'
              ? t('export.exported')
              : t('export.export')}
        </Button>
      </div>
    </Modal>
  );
}
