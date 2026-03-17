import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export default function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    'px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-primary text-bg hover:bg-primary-hover',
    secondary:
      'bg-transparent border border-border text-text hover:bg-surface-elevated',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
