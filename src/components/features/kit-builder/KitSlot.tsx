import { useState, useCallback, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, X, Plus, GripVertical } from 'lucide-react';
import { KitSlotData } from '../../../store/kit-store';

interface KitSlotProps {
  index: number;
  slot: KitSlotData;
  isPlaying: boolean;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
  onPlay: () => void;
  onDrop: (soundName: string, filePath: string) => void;
  onReorderStart: (fromIndex: number) => void;
  onReorderDrop: (toIndex: number) => void;
}

export default function KitSlot({
  index,
  slot,
  isPlaying,
  onLabelChange,
  onRemove,
  onPlay,
  onDrop,
  onReorderStart,
  onReorderDrop,
}: KitSlotProps) {
  const { t } = useTranslation();
  const isEmpty = !slot.soundName;
  const [dragOver, setDragOver] = useState(false);

  const handleDragStart = useCallback((e: DragEvent) => {
    if (isEmpty) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/wavloom-slot', String(index));
    e.dataTransfer.effectAllowed = 'move';
    onReorderStart(index);
  }, [index, isEmpty, onReorderStart]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const hasSound = e.dataTransfer.types.includes('application/wavloom-sound');
    const hasSlot = e.dataTransfer.types.includes('application/wavloom-slot');
    if (hasSound || hasSlot) {
      e.dataTransfer.dropEffect = hasSlot ? 'move' : 'copy';
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Check for slot reorder first
    const slotData = e.dataTransfer.getData('application/wavloom-slot');
    if (slotData !== '') {
      onReorderDrop(index);
      return;
    }

    // Check for sound drop
    const soundData = e.dataTransfer.getData('application/wavloom-sound');
    if (soundData) {
      try {
        const { soundName, filePath } = JSON.parse(soundData);
        if (soundName && filePath) {
          onDrop(soundName, filePath);
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }, [index, onDrop, onReorderDrop]);

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors group ${
        dragOver
          ? 'border-primary bg-primary-muted'
          : 'border-border bg-surface hover:bg-surface-elevated'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag handle for reordering */}
      <div
        draggable={!isEmpty}
        onDragStart={handleDragStart}
        className={`shrink-0 ${isEmpty ? 'text-text-muted opacity-30' : 'text-text-muted cursor-grab active:cursor-grabbing hover:text-text'}`}
      >
        <GripVertical size={12} />
      </div>

      {/* Index */}
      <span className="text-[10px] text-text-muted w-5 text-right shrink-0 tabular-nums">
        {index + 1}
      </span>

      {/* Label input */}
      <input
        type="text"
        value={slot.label}
        onChange={(e) => onLabelChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent text-xs text-text border-none outline-none placeholder:text-text-muted focus:bg-surface-elevated px-1.5 py-0.5 rounded-sm transition-colors"
        placeholder={t('kitSlot.labelPlaceholder')}
        aria-label={t('kitSlot.labelAria', { num: index + 1 })}
      />

      {isEmpty ? (
        /* Empty slot */
        <div className="flex items-center gap-1 text-text-muted">
          <Plus size={12} />
          <span className="text-[10px] whitespace-nowrap">{t('kitSlot.dragHere')}</span>
        </div>
      ) : (
        /* Filled slot */
        <>
          <span className="text-[10px] text-text-secondary truncate max-w-[80px]">
            {slot.soundName}
          </span>

          <button
            onClick={onPlay}
            className={`p-0.5 transition-colors ${
              isPlaying
                ? 'text-primary opacity-100'
                : 'text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            }`}
            title={isPlaying ? t('kitSlot.stop') : t('kitSlot.play')}
            aria-label={isPlaying ? t('kitSlot.stopAria', { num: index + 1 }) : t('kitSlot.playAria', { num: index + 1 })}
          >
            {isPlaying ? <Square size={12} /> : <Play size={12} />}
          </button>

          <button
            onClick={onRemove}
            className="p-0.5 text-text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            title={t('kitSlot.removeTitle')}
            aria-label={t('kitSlot.removeAria', { num: index + 1 })}
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}
