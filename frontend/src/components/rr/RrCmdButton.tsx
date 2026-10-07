import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { RR_CURSOR_DQ } from './constants';

interface RrCmdButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'danger' | 'ghost';
  showCursor?: boolean;
}

export function RrCmdButton({
  children,
  variant = 'default',
  showCursor = true,
  className = '',
  ...rest
}: RrCmdButtonProps) {
  const selected = showCursor && !rest.disabled;
  const { type = 'button', ...buttonProps } = rest;
  return (
    <button
      type={type}
      className={`rr-cmd-item${variant === 'danger' ? ' rr-cmd-item--danger' : ''}${className ? ` ${className}` : ''}`}
      aria-selected={selected}
      {...buttonProps}
    >
      <img className="rr-cursor rr-cursor--dq rr-cmd-item__cursor" src={RR_CURSOR_DQ} alt="" />
      <span className="rr-cmd-item__text">{children}</span>
    </button>
  );
}
