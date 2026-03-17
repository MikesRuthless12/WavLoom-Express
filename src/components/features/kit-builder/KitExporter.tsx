import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useKitStore } from '../../../store/kit-store';
import { exportKitSlot, type ExportFormat, type WavBitDepth, type Mp3Bitrate, type FlacBitDepth, type AiffBitDepth } from '../../../audio/exporter';

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

/** Replace invalid filesystem characters with underscores. */
function sanitizeName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'Untitled';
}

interface KitExporterProps {
  open: boolean;
  onClose: () => void;
}

export default function KitExporter({ open, onClose }: KitExporterProps) {
  const { t } = useTranslation();
  const kitName = useKitStore((s) => s.currentKitName);
  const kitId = useKitStore((s) => s.currentKitId);
  const slots = useKitStore((s) => s.slots);

  const [format, setFormat] = useState<ExportFormat>('wav');
  const [wavBitDepth, setWavBitDepth] = useState<WavBitDepth>(16);
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3Bitrate>(320);
  const [flacBitDepth, setFlacBitDepth] = useState<FlacBitDepth>(16);
  const [aiffBitDepth, setAiffBitDepth] = useState<AiffBitDepth>(16);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState('');

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setExportState('idle');
    setProgress({ current: 0, total: 0 });
    setErrorMsg('');
  }, [open]);

  const handleExport = useCallback(async () => {
    // Open directory picker
    const dirPath = await window.electronAPI.openDirectory();
    if (!dirPath) return;

    const safeName = sanitizeName(kitName);
    const kitDir = `${dirPath}/${safeName}`;
    const extMap: Record<ExportFormat, string> = { wav: 'wav', mp3: 'mp3', flac: 'flac', aiff: 'aiff' };
    const ext = extMap[format];

    // Collect filled slots
    const filledSlots = slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.filePath !== null);

    setExportState('exporting');
    setProgress({ current: 0, total: filledSlots.length });

    try {
      await window.electronAPI.createDirectory(kitDir);

      for (let i = 0; i < filledSlots.length; i++) {
        const { slot, index } = filledSlots[i];
        const safeLabel = sanitizeName(slot.label);
        const paddedIndex = String(index + 1).padStart(2, '0');
        const fileName = `${safeLabel}_${paddedIndex}.${ext}`;
        const outputPath = `${kitDir}/${fileName}`;

        await exportKitSlot(slot.filePath!, outputPath, {
          format,
          wavBitDepth,
          mp3Bitrate,
          flacBitDepth,
          aiffBitDepth,
        });
        setProgress({ current: i + 1, total: filledSlots.length });
      }

      // Save the export path to the kit record
      if (kitId !== null) {
        await window.electronAPI.updateKit(kitId, { exported_path: kitDir });
      }

      setExportState('done');
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setExportState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
    }
  }, [format, wavBitDepth, mp3Bitrate, flacBitDepth, aiffBitDepth, kitName, kitId, slots, onClose]);

  const formatBtnClass = (active: boolean) =>
    `px-3 py-1.5 rounded text-xs font-mono font-semibold border transition-colors ${
      active
        ? 'border-primary bg-primary-muted text-primary'
        : 'border-border bg-surface text-text-muted hover:border-text-muted'
    }`;

  return (
    <Modal open={open} onClose={onClose} aria-label={t('kitExport.title')}>
      <h2 className="text-sm font-semibold text-text mb-4">{t('kitExport.title')}</h2>

      {exportState === 'idle' && (
        <>
          {/* Format selector */}
          <div className="mb-4">
            <label className="text-xs text-text-muted mb-1.5 block">{t('kitExport.format')}</label>
            <div className="flex gap-2">
              <button className={formatBtnClass(format === 'wav')} onClick={() => setFormat('wav')}>
                {t('export.wav')}
              </button>
              <button className={formatBtnClass(format === 'mp3')} onClick={() => setFormat('mp3')}>
                {t('export.mp3')}
              </button>
              <button className={formatBtnClass(format === 'flac')} onClick={() => setFormat('flac')}>
                {t('export.flac')}
              </button>
              <button className={formatBtnClass(format === 'aiff')} onClick={() => setFormat('aiff')}>
                {t('export.aiff')}
              </button>
            </div>
          </div>

          {/* Quality selector */}
          <div className="mb-4">
            <label className="text-xs text-text-muted mb-1.5 block">
              {format === 'mp3' ? t('kitExport.bitrate') : t('kitExport.bitDepth')}
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

          <p className="text-xs text-text-muted mb-4">
            {t('kitExport.description')}
          </p>
        </>
      )}

      {exportState === 'exporting' && (
        <p className="text-xs text-text-muted mb-4">
          {t('kitExport.progress', { current: progress.current, total: progress.total })}
        </p>
      )}

      {exportState === 'done' && (
        <p className="text-xs text-green-400 mb-4">{t('kitExport.done')}</p>
      )}

      {exportState === 'error' && (
        <p className="text-xs text-red-400 mb-4">{errorMsg}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={exportState === 'exporting'}>
          {t('kitExport.cancel')}
        </Button>
        <Button
          onClick={handleExport}
          disabled={exportState === 'exporting' || exportState === 'done'}
        >
          {exportState === 'exporting'
            ? t('kitExport.progress', { current: progress.current, total: progress.total })
            : exportState === 'done'
              ? t('kitExport.exported')
              : t('kitExport.chooseFolder')}
        </Button>
      </div>
    </Modal>
  );
}
