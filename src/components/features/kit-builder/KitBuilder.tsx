import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { useKitStore } from '../../../store/kit-store';
import { AudioEngine } from '../../../audio/engine';
import Button from '../../ui/Button';
import KitSlot from './KitSlot';
import KitExporter from './KitExporter';

const SLOT_COUNTS = [8, 12, 16] as const;

export default function KitBuilder() {
  const { t } = useTranslation();
  const kitName = useKitStore((s) => s.currentKitName);
  const slots = useKitStore((s) => s.slots);
  const slotCount = useKitStore((s) => s.slotCount);
  const setKitName = useKitStore((s) => s.setKitName);
  const setSlotCount = useKitStore((s) => s.setSlotCount);
  const addSoundToSlot = useKitStore((s) => s.addSoundToSlot);
  const removeSlot = useKitStore((s) => s.removeSlot);
  const reorderSlot = useKitStore((s) => s.reorderSlot);
  const updateSlotLabel = useKitStore((s) => s.updateSlotLabel);

  const hasFilledSlots = slots.some((s) => s.soundName !== null);
  const reorderFromRef = useRef<number | null>(null);
  const [playingSlotIndex, setPlayingSlotIndex] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Register one-shot ended callback to clear playing state
  useEffect(() => {
    const engine = AudioEngine.getInstance();
    engine.onOneShotEnded(() => {
      setPlayingSlotIndex(null);
    });
    return () => {
      engine.onOneShotEnded(null);
    };
  }, []);

  const handlePlay = useCallback(async (index: number) => {
    const engine = AudioEngine.getInstance();
    const slot = useKitStore.getState().slots[index];
    if (!slot?.filePath) return;

    // Toggle: if this slot is already playing, stop it
    if (playingSlotIndex === index) {
      engine.stopOneShot();
      setPlayingSlotIndex(null);
      return;
    }

    try {
      const arrayBuffer = await window.electronAPI.readAudioFile(slot.filePath);
      const duration = await engine.playOneShot(arrayBuffer);
      setPlayingSlotIndex(index);

      // Short sounds (< 5s) will auto-stop via onEnded callback.
      // Long sounds can be stopped by clicking play again (toggle).
      // The onOneShotEnded callback handles clearing the state for both cases.
      void duration; // duration used implicitly via onEnded
    } catch {
      setPlayingSlotIndex(null);
    }
  }, [playingSlotIndex]);

  const handleSlotDrop = useCallback(
    (index: number, soundName: string, filePath: string) => {
      addSoundToSlot(index, soundName, filePath);
    },
    [addSoundToSlot],
  );

  const handleReorderStart = useCallback((fromIndex: number) => {
    reorderFromRef.current = fromIndex;
  }, []);

  const handleReorderDrop = useCallback(
    (toIndex: number) => {
      const fromIndex = reorderFromRef.current;
      if (fromIndex !== null && fromIndex !== toIndex) {
        reorderSlot(fromIndex, toIndex);
      }
      reorderFromRef.current = null;
    },
    [reorderSlot],
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Kit name */}
      <input
        type="text"
        value={kitName}
        onChange={(e) => setKitName(e.target.value)}
        className="bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text font-medium placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors"
        placeholder={t('kit.namePlaceholder')}
        aria-label={t('kit.nameAria')}
      />

      {/* Slot count selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wide">{t('kit.slots')}</span>
        <div className="flex gap-1">
          {SLOT_COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => setSlotCount(count)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-sm border transition-colors ${
                slotCount === count
                  ? 'border-primary text-primary bg-primary-muted'
                  : 'border-border text-text-secondary bg-transparent hover:text-text hover:border-text-muted'
              }`}
              aria-label={t('kit.slotsAria', { count })}
              aria-pressed={slotCount === count}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Slot list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {slots.map((slot, i) => (
          <KitSlot
            key={slot.id}
            index={i}
            slot={slot}
            isPlaying={playingSlotIndex === i}
            onLabelChange={(label) => updateSlotLabel(i, label)}
            onRemove={() => removeSlot(i)}
            onPlay={() => handlePlay(i)}
            onDrop={(soundName, filePath) => handleSlotDrop(i, soundName, filePath)}
            onReorderStart={handleReorderStart}
            onReorderDrop={handleReorderDrop}
          />
        ))}
      </div>

      {/* Export button */}
      <Button
        disabled={!hasFilledSlots}
        onClick={() => setExportOpen(true)}
        className="w-full flex items-center justify-center gap-2 text-xs"
      >
        <Download size={14} />
        {t('kit.exportKit')}
      </Button>

      <KitExporter open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
