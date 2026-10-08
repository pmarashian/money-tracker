import type { ReactNode } from 'react';
import { RetroCoinSprite } from './RetroCoinSprite';

export type RetroLoaderProps = {
  /** Uppercase-friendly status line (animated ellipsis appended when motion allowed). */
  label?: string;
  /** `inline` for embedded panels (e.g. chat); default is full content-area block. */
  variant?: 'block' | 'inline';
  className?: string;
};

export function RetroLoader({
  label = 'LOADING',
  variant = 'block',
  className,
}: RetroLoaderProps) {
  const rootClass = [
    'rr-loader',
    variant === 'inline' ? 'rr-loader--inline' : 'rr-loader--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite" aria-busy="true">
      <div className="rr-win rr-win--dq rr-loader__window">
        <div className="rr-loader__sprite-slot">
          <RetroCoinSprite />
        </div>
        <p className="rr-loader__label">
          {label}
          <span className="rr-loader__dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
          <span className="rr-loader__cursor" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}

type RetroLoaderViewportProps = {
  children: ReactNode;
  className?: string;
};

/** Centers loader in ion-content below the header (respects tab bar padding on .has-tab-bar). */
export function RetroLoaderViewport({ children, className }: RetroLoaderViewportProps) {
  return (
    <div className={['rr-loader-viewport', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
