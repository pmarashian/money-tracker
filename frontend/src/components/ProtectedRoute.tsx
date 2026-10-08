import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RetroLoaderScreen } from './RetroLoaderPage';
import { useRetroPageLoading } from '../hooks/useRetroPageLoading';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  const { showLoader, blocking } = useRetroPageLoading(loading);

  if (blocking) {
    return showLoader ? <RetroLoaderScreen label="LOADING" /> : null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;