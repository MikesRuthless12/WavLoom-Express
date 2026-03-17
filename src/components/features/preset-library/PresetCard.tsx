import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Preset } from '../../../store/preset-store';

interface PresetCardProps {
  preset: Preset;
  onSelect: (preset: Preset) => void;
  onDelete?: (preset: Preset) => void;
  onExport?: (preset: Preset) => void;
  deletable?: boolean;
  selected?: boolean;
  onFocus?: (presetId: number) => void;
}

export default function PresetCard({ preset, onSelect, onDelete, onExport, deletable, selected, onFocus }: PresetCardProps) {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);

  const hasMenu = deletable || !!onExport;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!hasMenu) return;
      e.preventDefault();
      setShowMenu(true);
    },
    [hasMenu],
  );

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    onDelete?.(preset);
  }, [onDelete, preset]);

  const handleExport = useCallback(() => {
    setShowMenu(false);
    onExport?.(preset);
  }, [onExport, preset]);

  return (
    <div className="relative">
      <button
        type="button"
        data-preset-id={preset.id}
        onClick={() => {
          onFocus?.(preset.id);
          onSelect(preset);
        }}
        onFocus={() => onFocus?.(preset.id)}
        onContextMenu={handleContextMenu}
        onBlur={() => setTimeout(() => setShowMenu(false), 150)}
        className={`w-full text-left px-3 py-1.5 text-xs rounded-sm transition-colors border outline-none ${
          selected
            ? 'border-primary bg-primary/10 text-text'
            : 'border-transparent text-text-secondary hover:text-text hover:bg-surface-elevated'
        }`}
        aria-label={t('presets.loadAria', { name: preset.name })}
      >
        {preset.name}
      </button>

      {showMenu && (
        <div className="absolute right-1 top-0 z-50 bg-surface-elevated border border-border rounded shadow-lg py-1 min-w-[100px]">
          {onExport && (
            <button
              type="button"
              onClick={handleExport}
              className="w-full text-left px-3 py-1 text-xs text-text-secondary hover:bg-surface transition-colors"
            >
              {t('presets.exportWlepreset')}
            </button>
          )}
          {deletable && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full text-left px-3 py-1 text-xs text-error hover:bg-surface transition-colors"
            >
              {t('presets.delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
