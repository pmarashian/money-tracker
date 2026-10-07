import type { ReactNode } from 'react';

interface RrWinProps {
  tag?: string;
  children: ReactNode;
  className?: string;
}

export function RrWin({ tag, children, className = '' }: RrWinProps) {
  return (
    <section className={`rr-win rr-win--dq${className ? ` ${className}` : ''}`}>
      {tag ? <span className="rr-tag">{tag}</span> : null}
      {children}
    </section>
  );
}
