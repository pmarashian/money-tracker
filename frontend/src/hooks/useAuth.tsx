import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiGet, apiPost } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setToken, clearToken } = useAuthStore();

  const checkAuth = async () => {
    try {
      const result = await apiGet<{ user: User }>('/api/auth/session');
      if (result.ok && result.data?.user) {
        setUser(result.data.user);
      } else {
        clearToken();
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await apiPost<{ token?: string; user?: User }>(
        '/api/auth/login',
        { email, password }
      );
      if (result.ok && result.data?.token) {
        setToken(result.data.token);
        if (result.data.user) {
          setUser(result.data.user);
        }
        await checkAuth();
        return { success: true };
      }
      return { success: false, error: result.error || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = async () => {
    try {
      await apiPost('/api/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const persist = useAuthStore.persist;
    if (persist?.hasHydrated?.()) {
      checkAuth();
      return;
    }
    const unsub = persist?.onFinishHydration?.(() => {
      checkAuth();
    });
    return () => {
      unsub?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};