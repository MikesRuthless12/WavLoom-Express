interface PanelProps {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export default function Panel({ children, className = '', 'aria-label': ariaLabel }: PanelProps) {
  return (
    <div className={`bg-surface h-full overflow-y-auto ${className}`} role="region" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
