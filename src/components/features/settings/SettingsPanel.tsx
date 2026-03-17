import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, FolderOpen, KeyRound, Globe } from 'lucide-react';
import Modal from '../../ui/Modal';

type ExportFormat = 'wav' | 'mp3' | 'flac' | 'aiff';
type BufferSize = '128' | '256' | '512' | '1024';

const BUFFER_SIZES: { value: BufferSize; label: string }[] = [
  { value: '128', label: '128' },
  { value: '256', label: '256' },
  { value: '512', label: '512' },
  { value: '1024', label: '1024' },
];

const SETTING_KEYS = {
  exportDir: 'default_export_directory',
  exportFormat: 'default_export_format',
  bufferSize: 'audio_buffer_size',
  language: 'language',
} as const;

const LANGUAGE_CODES = ['en', 'es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'ru', 'hi'] as const;

export default function SettingsPanel() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [exportDir, setExportDir] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('wav');
  const [bufferSize, setBufferSize] = useState<BufferSize>('512');
  const [language, setLanguage] = useState(i18n.language);
  const [loading, setLoading] = useState(true);

  // Load settings when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    Promise.all([
      window.electronAPI.getSetting(SETTING_KEYS.exportDir),
      window.electronAPI.getSetting(SETTING_KEYS.exportFormat),
      window.electronAPI.getSetting(SETTING_KEYS.bufferSize),
      window.electronAPI.getSetting(SETTING_KEYS.language),
    ]).then(async ([dir, format, buffer, lang]) => {
      if (dir) {
        setExportDir(dir);
      } else {
        const defaultDir = await window.electronAPI.getDefaultExportDir();
        setExportDir(defaultDir);
      }
      if (format === 'wav' || format === 'mp3' || format === 'flac' || format === 'aiff') setExportFormat(format);
      if (['128', '256', '512', '1024'].includes(buffer ?? '')) setBufferSize(buffer as BufferSize);
      if (lang) setLanguage(lang);
      setLoading(false);
    });
  }, [open]);

  const handleBrowseDir = async () => {
    const dir = await window.electronAPI.openDirectory();
    if (dir) {
      setExportDir(dir);
      await window.electronAPI.setSetting(SETTING_KEYS.exportDir, dir);
    }
  };

  const handleFormatChange = async (format: ExportFormat) => {
    setExportFormat(format);
    await window.electronAPI.setSetting(SETTING_KEYS.exportFormat, format);
  };

  const handleBufferChange = async (size: BufferSize) => {
    setBufferSize(size);
    await window.electronAPI.setSetting(SETTING_KEYS.bufferSize, size);
  };

  const handleLanguageChange = async (code: string) => {
    setLanguage(code);
    await i18n.changeLanguage(code);
    await window.electronAPI.setSetting(SETTING_KEYS.language, code);
  };

  const selectClass = 'bg-surface border border-border rounded px-3 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-primary cursor-pointer appearance-none';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-8 h-7 rounded text-text-secondary hover:text-primary hover:bg-surface-elevated transition-colors"
        aria-label={t('settings.aria')}
      >
        <Settings size={14} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} aria-label={t('settings.title')}>
        <h2 className="text-sm font-semibold text-text mb-5">{t('settings.title')}</h2>

        {loading ? (
          <p className="text-xs text-text-muted py-4">{t('settings.loading')}</p>
        ) : (
          <div className="space-y-5">
            {/* Default Export Directory */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">{t('settings.exportDir')}</label>
              <div className="flex gap-2 items-center">
                <span className="flex-1 text-xs text-text font-mono bg-surface border border-border rounded px-3 py-1.5 truncate" title={exportDir}>
                  {exportDir}
                </span>
                <button
                  onClick={handleBrowseDir}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text transition-colors"
                  aria-label={t('settings.browseDir')}
                >
                  <FolderOpen size={12} />
                  {t('settings.browse')}
                </button>
              </div>
            </div>

            {/* Default Export Format */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">{t('settings.exportFormat')}</label>
              <select
                value={exportFormat}
                onChange={(e) => handleFormatChange(e.target.value as ExportFormat)}
                className={selectClass}
              >
                <option value="wav">{t('export.wav')}</option>
                <option value="mp3">{t('export.mp3')}</option>
                <option value="flac">{t('export.flac')}</option>
                <option value="aiff">{t('export.aiff')}</option>
              </select>
            </div>

            {/* Audio Buffer Size */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">{t('settings.bufferSize')}</label>
              <select
                value={bufferSize}
                onChange={(e) => handleBufferChange(e.target.value as BufferSize)}
                className={selectClass}
              >
                {BUFFER_SIZES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t('settings.samples', { size: opt.label })}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block">{t('settings.language')}</label>
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-text-muted" />
                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className={selectClass}
                >
                  {/* English always first, rest sorted alphabetically by translated name */}
                  <option value="en">{t('lang.en')}</option>
                  {LANGUAGE_CODES
                    .filter((code) => code !== 'en')
                    .map((code) => ({ code, label: t(`lang.${code}`) }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Manage License */}
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => {
                  // TODO: Open activation dialog when implemented
                }}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary-hover transition-colors"
              >
                <KeyRound size={12} />
                {t('settings.license')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
