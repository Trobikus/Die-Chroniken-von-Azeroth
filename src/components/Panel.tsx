import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  icon?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, icon, subtitle, action, children, className = '' }: PanelProps) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>
          {icon && <span className="panel-icon">{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      {subtitle && <p className="panel-sub">{subtitle}</p>}
      <div className="panel-body">{children}</div>
    </section>
  );
}

interface BarProps {
  value: number;
  max: number;
  color: string;
  label?: string;
  compact?: boolean;
}

export function Bar({ value, max, color, label, compact = false }: BarProps) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`bar ${compact ? 'bar-compact' : ''}`}>
      {label && (
        <div className="bar-label">
          <span>{label}</span>
          <span>
            {Math.ceil(Math.max(0, value))} / {Math.ceil(max)}
          </span>
        </div>
      )}
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
