import { InputHTMLAttributes } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export default function Toggle({
  checked = false,
  onChange,
  className = '',
  label,
  ...props
}: ToggleProps) {
  return (
    <label
      className={`relative inline-flex items-center w-10 min-h-[44px] cursor-pointer ${className}`}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        role="switch"
        checked={checked}
        aria-checked={checked}
        aria-label={label}
        onChange={(e) => onChange?.(e.target.checked)}
        {...props}
      />
      <span className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-5 rounded-full bg-surface-elevated transition-colors duration-200 peer-checked:bg-primary" />
      <span className="absolute top-1/2 -translate-y-1/2 left-0.5 h-4 w-4 rounded-full bg-text transition-transform duration-200 peer-checked:translate-x-5" />
    </label>
  );
}
