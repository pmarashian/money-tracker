import type { ReactNode } from 'react';

interface NesPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function NesPanel({ title, children, className = '' }: NesPanelProps) {
  return (
    <section className={`nes-panel${className ? ` ${className}` : ''}`}>
      {title ? <h2 className="nes-panel__title">{title}</h2> : null}
      <div className="nes-panel__body">{children}</div>
    </section>
  );
}
