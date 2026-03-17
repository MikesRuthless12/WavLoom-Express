import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`bg-surface border border-border rounded-md px-3 py-2 text-text font-sans text-sm placeholder:text-text-muted focus:border-primary focus:outline-none transition-colors ${className}`}
      {...props}
    />
  );
}
