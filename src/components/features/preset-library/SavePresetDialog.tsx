import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { useAudioStore } from '../../../store/audio-store';
import { usePresetStore } from '../../../store/preset-store';

interface SavePresetDialogProps {
  open: boolean;
  onClose: () => void;
}

const BUILT_IN_CATEGORIES = [
  'Kicks',
  'Snares',
  'Hi-Hats',
  'Claps',
  'Toms',
  '808s',
  'Piano',
  'Flute',
  'Strings',
  'Brass',
];

export default function SavePresetDialog({ open, onClose }: SavePresetDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('My Sound');
  const [category, setCategory] = useState('Kicks');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadPresets = usePresetStore((s) => s.loadPresets);
  const presets = usePresetStore((s) => s.presets);

  // Collect unique categories from existing presets (including user-created ones)
  const allCategories = Array.from(
    new Set([...BUILT_IN_CATEGORIES, ...presets.map((p) => p.category).filter(Boolean)]),
  );

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setName('My Sound');
    setCategory('Kicks');
    setSaving(false);
    setSaved(false);
    setErrorMsg('');
  }, [open]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg(t('savePreset.nameRequired'));
      return;
    }

    const duplicate = presets.some(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) {
      setErrorMsg(t('savePreset.duplicate'));
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const { effects, mode, filePath } = useAudioStore.getState();
      const effectsJson = JSON.stringify(effects);

      await window.electronAPI.savePreset({
        name: trimmedName,
        category,
        effects_defaults: effectsJson,
        mode,
        file_path: filePath || null,
      });

      // Refresh the preset list
      await loadPresets();

      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setSaving(false);
      setErrorMsg(err instanceof Error ? err.message : t('savePreset.failed'));
    }
  }, [name, category, loadPresets, onClose]);

  const selectClass =
    'w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-primary cursor-pointer appearance-none';

  return (
    <Modal open={open} onClose={onClose} aria-label={t('savePreset.title')}>
      <h2 className="text-sm font-semibold text-text mb-4">{t('savePreset.title')}</h2>

      {/* Preset name */}
      <div className="mb-4">
        <label className="text-xs text-text-muted mb-1.5 block">{t('savePreset.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="w-full bg-surface border border-border rounded px-3 py-1.5 text-xs text-text font-mono focus:outline-none focus:border-primary"
          placeholder={t('savePreset.placeholder')}
          autoFocus
        />
      </div>

      {/* Category selector */}
      <div className="mb-4">
        <label className="text-xs text-text-muted mb-1.5 block">{t('savePreset.category')}</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectClass}
        >
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="Custom">{t('savePreset.custom')}</option>
        </select>
      </div>

      {/* Error */}
      {errorMsg && <p className="text-xs text-error mb-3">{errorMsg}</p>}

      {/* Saved confirmation */}
      {saved && <p className="text-xs text-success mb-3">{t('savePreset.saved')}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          {t('savePreset.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={saving || saved}>
          {saving ? t('savePreset.saving') : saved ? t('savePreset.savedBtn') : t('savePreset.save')}
        </Button>
      </div>
    </Modal>
  );
}
