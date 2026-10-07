import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { RR_CURSOR_DQ } from '../rr/constants';

interface AuthMenuLinkProps {
  to: string;
  children: ReactNode;
  replace?: boolean;
}

export function AuthMenuLink({ to, children, replace }: AuthMenuLinkProps) {
  return (
    <Link to={to} replace={replace} className="rr-cmd-item auth-screen__menu-link">
      <img className="rr-cursor rr-cursor--dq" src={RR_CURSOR_DQ} alt="" />
      <span className="rr-cmd-item__text">{children}</span>
    </Link>
  );
}
