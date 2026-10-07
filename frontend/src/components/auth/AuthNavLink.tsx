import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface AuthNavLinkProps {
  to: string;
  children: ReactNode;
  replace?: boolean;
}

export function AuthNavLink({ to, children, replace }: AuthNavLinkProps) {
  return (
    <Link to={to} replace={replace} className="auth-screen__nav-link">
      {children}
    </Link>
  );
}
