import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Import } from 'lucide-react';
import { usePresetStore, type Preset } from '../../../store/preset-store';
import { useAudioStore } from '../../../store/audio-store';
import { AudioEngine } from '../../../audio/engine';
import { loadAudioFile } from '../../../audio/load-audio-file';
import PresetCard from './PresetCard';

/** A navigable item: either a category header or a preset */
type NavItem =
  | { type: 'category'; key: string; label: string }
  | { type: 'preset'; preset: Preset };

export default function PresetBrowser() {
  const { t } = useTranslation();
  const categories = usePresetStore((s) => s.categories);
  const selectedCategory = usePresetStore((s) => s.selectedCategory);
  const setSelectedCategory = usePresetStore((s) => s.setSelectedCategory);
  const presets = usePresetStore((s) => s.presets);
  const presetsLoading = usePresetStore((s) => s.presetsLoading);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const deletePreset = usePresetStore((s) => s.deletePreset);
  const importPreset = usePresetStore((s) => s.importPreset);
  const exportPreset = usePresetStore((s) => s.exportPreset);

  const [selectedId, setSelectedId] = useState<string | null>(null); // "cat:Key" or "preset:123"
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const userPresets = useMemo(
    () => presets.filter((p) => p.preset_type === 'user'),
    [presets],
  );

  const presetsByCategory = useMemo(() => {
    const map = new Map<string, Preset[]>();
    for (const preset of presets) {
      if (preset.preset_type === 'user') continue;
      const cat = preset.category ?? 'Uncategorized';
      const list = map.get(cat);
      if (list) list.push(preset);
      else map.set(cat, [preset]);
    }
    return map;
  }, [presets]);

  // Build flat navigation list of visible items
  const navItems = useMemo(() => {
    const items: NavItem[] = [];

    // My Presets
    if (userPresets.length > 0) {
      items.push({ type: 'category', key: '__my_presets__', label: t('presets.myPresets') });
      if (selectedCategory === '__my_presets__') {
        for (const p of userPresets) items.push({ type: 'preset', preset: p });
      }
    }

    // Built-in categories
    for (const cat of categories) {
      items.push({ type: 'category', key: cat, label: cat });
      if (selectedCategory === cat) {
        const catPresets = presetsByCategory.get(cat) ?? [];
        for (const p of catPresets) items.push({ type: 'preset', preset: p });
      }
    }
    return items;
  }, [userPresets, categories, selectedCategory, presetsByCategory, t]);

  const getNavId = (item: NavItem) =>
    item.type === 'category' ? `cat:${item.key}` : `preset:${item.preset.id}`;

  const handleSelectPreset = useCallback((preset: Preset) => {
    if (preset.effects_defaults) {
      try {
        const defaults = JSON.parse(preset.effects_defaults) as Record<string, number>;
        const setEffect = useAudioStore.getState().setEffect;
        for (const [key, value] of Object.entries(defaults)) {
          setEffect(key as keyof typeof defaults & ('reverb' | 'delay' | 'pitch' | 'distortion' | 'filter' | 'volume'), value);
        }
      } catch { /* ignore */ }
    }
    useAudioStore.getState().setSource('preset', preset.id);
    if (preset.file_path) loadAudioFile(preset.file_path);
  }, []);

  const handleDeletePreset = useCallback((preset: Preset) => {
    deletePreset(preset.id);
  }, [deletePreset]);

  const handleImportPreset = useCallback(() => {
    importPreset();
  }, [importPreset]);

  const handleSelectPresetReversed = useCallback(async (preset: Preset) => {
    // Apply effects defaults
    if (preset.effects_defaults) {
      try {
        const defaults = JSON.parse(preset.effects_defaults) as Record<string, number>;
        const setEffect = useAudioStore.getState().setEffect;
        for (const [key, value] of Object.entries(defaults)) {
          setEffect(key as keyof typeof defaults & ('reverb' | 'delay' | 'pitch' | 'distortion' | 'filter' | 'volume'), value);
        }
      } catch { /* ignore */ }
    }
    useAudioStore.getState().setSource('preset', preset.id);
    if (preset.file_path) {
      await loadAudioFile(preset.file_path);
      const engine = AudioEngine.getInstance();
      engine.reverseBuffer();
      useAudioStore.getState().setReversed(true);
    }
  }, []);

  const handleExportPreset = useCallback((preset: Preset) => {
    exportPreset(preset);
  }, [exportPreset]);

  // Keep selection valid: auto-select first if nothing selected,
  // or re-select if current selection is no longer visible
  useEffect(() => {
    if (navItems.length === 0) return;
    if (!selectedId) {
      setSelectedId(getNavId(navItems[0]));
      return;
    }
    if (!navItems.some((item) => getNavId(item) === selectedId)) {
      setSelectedId(getNavId(navItems[0]));
    }
  }, [navItems, selectedId]);

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Space from triggering click on focused button — let global play/pause handle it
      if (e.code === 'Space') {
        e.preventDefault();
        return;
      }

      if (navItems.length === 0) return;
      const currentIdx = navItems.findIndex((item) => getNavId(item) === selectedId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIdx < navItems.length - 1) {
          setSelectedId(getNavId(navItems[currentIdx + 1]));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIdx > 0) {
          setSelectedId(getNavId(navItems[currentIdx - 1]));
        }
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (currentIdx < 0) return;
        const item = navItems[currentIdx];
        if (item.type === 'category') {
          // Toggle open/close: if already expanded, collapse; else expand
          if (selectedCategory === item.key) {
            setSelectedCategory(null as unknown as string);
          } else {
            setSelectedCategory(item.key);
          }
        } else {
          handleSelectPreset(item.preset);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIdx < 0) return;
        const item = navItems[currentIdx];
        if (item.type === 'category' && selectedCategory === item.key) {
          // Collapse the category
          setSelectedCategory(null as unknown as string);
        } else if (item.type === 'preset') {
          handleSelectPresetReversed(item.preset);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [navItems, selectedId, selectedCategory, setSelectedCategory, handleSelectPreset, handleSelectPresetReversed]);

  // Scroll selected into view
  useEffect(() => {
    if (!selectedId) return;
    const el = containerRef.current?.querySelector(`[data-nav-id="${CSS.escape(selectedId)}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  if (presetsLoading) {
    return (
      <div className="flex flex-col gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1.5">
            <div className="skeleton w-3 h-3 shrink-0" />
            <div className="skeleton h-3 flex-1" style={{ maxWidth: `${50 + i * 10}%` }} />
            <div className="skeleton w-4 h-3 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  const isMyPresetsExpanded = selectedCategory === '__my_presets__';

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-1 overflow-y-auto fade-in outline-none"
      tabIndex={0}
    >
      {/* Import Preset button */}
      <button
        type="button"
        onClick={handleImportPreset}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-primary hover:text-primary-hover hover:bg-surface-elevated rounded-sm transition-colors"
        aria-label={t('presets.importAria')}
      >
        <Import size={12} className="shrink-0" />
        {t('presets.import')}
      </button>

      <div className="h-px bg-border mx-2" />

      {/* My Presets section */}
      {userPresets.length > 0 && (
        <div>
          <button
            type="button"
            data-nav-id="cat:__my_presets__"
            onClick={() => {
              setSelectedId('cat:__my_presets__');
              setSelectedCategory('__my_presets__');
            }}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-sm transition-colors border outline-none ${
              selectedId === 'cat:__my_presets__'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-transparent text-primary hover:text-primary-hover hover:bg-surface-elevated'
            }`}
            aria-expanded={isMyPresetsExpanded}
            aria-label={t('presets.myPresets')}
          >
            {isMyPresetsExpanded ? (
              <ChevronDown size={12} className="shrink-0" />
            ) : (
              <ChevronRight size={12} className="shrink-0" />
            )}
            {t('presets.myPresets')}
            <span className="ml-auto text-text-muted">{userPresets.length}</span>
          </button>

          {isMyPresetsExpanded && (
            <div className="ml-4">
              {userPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onSelect={handleSelectPreset}
                  onDelete={handleDeletePreset}
                  onExport={handleExportPreset}
                  deletable
                  selected={selectedId === `preset:${preset.id}`}
                  onFocus={(id) => setSelectedId(`preset:${id}`)}
                />
              ))}
            </div>
          )}

          <div className="h-px bg-border mx-2 my-1" />
        </div>
      )}

      {categories.map((category) => {
        const isExpanded = selectedCategory === category;
        const categoryPresets = presetsByCategory.get(category) ?? [];
        const catNavId = `cat:${category}`;

        return (
          <div key={category}>
            <button
              type="button"
              data-nav-id={catNavId}
              onClick={() => {
                setSelectedId(catNavId);
                setSelectedCategory(category);
              }}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-sm transition-colors border outline-none ${
                selectedId === catNavId
                  ? 'border-primary bg-primary/10 text-text'
                  : 'border-transparent text-text-secondary hover:text-text hover:bg-surface-elevated'
              }`}
              aria-expanded={isExpanded}
              aria-label={t('presets.categoryAria', { category })}
            >
              {isExpanded ? (
                <ChevronDown size={12} className="shrink-0" />
              ) : (
                <ChevronRight size={12} className="shrink-0" />
              )}
              {category}
              <span className="ml-auto text-text-muted">{categoryPresets.length}</span>
            </button>

            {isExpanded && categoryPresets.length > 0 && (
              <div className="ml-4">
                {categoryPresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onSelect={handleSelectPreset}
                    selected={selectedId === `preset:${preset.id}`}
                    onFocus={(id) => setSelectedId(`preset:${id}`)}
                  />
                ))}
              </div>
            )}

            {isExpanded && categoryPresets.length === 0 && (
              <p className="ml-4 px-3 py-1 text-xs text-text-muted">{t('presets.empty')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
