import { useTranslation } from 'react-i18next';
import useKnob from '../../hooks/useKnob';

interface KnobProps {
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  /** Optional controlled value — knob syncs to this when changed externally. */
  value?: number;
  onChange?: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: (changed: boolean) => void;
  onChangeStart?: () => void;
  formatValue?: (value: number) => string;
}

export default function Knob({
  label,
  defaultValue = 50,
  min = 0,
  max = 100,
  value: externalValue,
  onChange,
  onDragStart,
  onDragEnd,
  onChangeStart,
  formatValue,
}: KnobProps) {
  const { t } = useTranslation();
  const { value, isDragging, knobProps } = useKnob({
    min,
    max,
    defaultValue,
    externalValue,
    onChange,
    onDragStart,
    onDragEnd,
    onChangeStart,
  });

  // Map value to angle: min → -135°, max → 135° (270° sweep)
  const angle = ((value - min) / (max - min)) * 270 - 135;
  const rad = (angle * Math.PI) / 180;

  // Indicator line endpoints (from r=12 to r=19, on a 24-radius center)
  const cx = 24;
  const cy = 24;
  const x1 = cx + 12 * Math.sin(rad);
  const y1 = cy - 12 * Math.cos(rad);
  const x2 = cx + 19 * Math.sin(rad);
  const y2 = cy - 19 * Math.cos(rad);

  const active = isDragging;
  const ringColor = active ? '#39FF14' : '#2A2A2A';
  const indicatorColor = active ? '#39FF14' : '#888888';

  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
      }}
    >
      {/* Label */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          fontWeight: 500,
          color: '#555555',
          lineHeight: 1,
        }}
      >
        {label}
      </span>

      {/* Knob */}
      <div
        {...knobProps}
        role="slider"
        tabIndex={0}
        aria-label={t('knob.aria', { label })}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayValue}
        style={{
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <svg
          width={48}
          height={48}
          viewBox="0 0 48 48"
          style={{
            overflow: 'visible',
            filter: active
              ? 'drop-shadow(0 0 8px rgba(57, 255, 20, 0.33))'
              : 'none',
          }}
        >
          {/* Background circle */}
          <circle cx={cx} cy={cy} r={22} fill="#1E1E1E" />
          {/* Border ring */}
          <circle
            cx={cx}
            cy={cy}
            r={22}
            fill="none"
            stroke={ringColor}
            strokeWidth={2}
          />
          {/* Position indicator */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={indicatorColor}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Value */}
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: '#888888',
          lineHeight: 1,
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}
