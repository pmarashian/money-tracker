import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { apiGet, apiPost } from "../lib/api";
import { waitForAuthFlush } from "../lib/authStorage";
import { useAuthStore } from "../store/authStore";
import logger from "../lib/logger";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setToken, clearToken } = useAuthStore();

  const checkAuth = async () => {
    const token = useAuthStore.getState().getToken();
    await logger.info(`[Auth] checkAuth called, token present: ${!!token}`);

    try {
      const result = await apiGet<{ user: User }>("/api/auth/session");
      if (result.ok && result.data?.user) {
        await logger.info("[Auth] Session check successful, user:", {
          email: result.data.user.email,
        });
        setUser(result.data.user);
      } else {
        await logger.info("[Auth] Session check failed, status:", {
          status: result.status,
          error: result.error,
        });

        // Only clear token if we're sure it's invalid (not just a hydration issue)
        // The API client already handles clearing token on 401 when hydrated
        if (result.status === 401) {
          // Token was sent but rejected - clear it
          clearToken();
          setUser(null);
        } else {
          // Other error - might be network issue, don't clear token
          setUser(null);
        }
      }
    } catch (error: any) {
      await logger.error("[Auth] Session check exception:", {
        error: error.message,
      });
      // Don't clear token on network errors
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
        "/api/auth/login",
        { email, password }
      );
      if (result.ok && result.data?.token) {
        setToken(result.data.token);
        try {
          await waitForAuthFlush();
        } catch (e) {
          console.warn(
            "Auth persist flush failed, token may not survive force-close:",
            e
          );
        }
        if (result.data.user) {
          setUser(result.data.user);
        }
        // Skip checkAuth() - we already have user data from login response
        // Session validation will happen on app startup via useEffect
        setLoading(false);
        return { success: true };
      }
      return { success: false, error: result.error || "Login failed" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  };

  const logout = async () => {
    try {
      await apiPost("/api/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const persist = useAuthStore.persist;

    // Check if hydration is complete
    const isHydrated = (): boolean => {
      return persist?.hasHydrated?.() ?? false;
    };

    // If already hydrated, check auth immediately
    if (isHydrated()) {
      console.log("[Auth] Store already hydrated, checking auth");
      checkAuth();
      return;
    }

    // Wait for hydration completion
    console.log("[Auth] Waiting for store hydration...");
    const unsub = persist?.onFinishHydration?.(() => {
      console.log("[Auth] Store hydration complete, checking auth");
      // Small delay to ensure state is fully updated after hydration
      setTimeout(() => {
        checkAuth();
      }, 10);
    });

    // Fallback: if hydration doesn't fire within reasonable time, check anyway
    // This handles edge cases where hydration event might not fire
    const fallbackTimeout = setTimeout(() => {
      if (isHydrated()) {
        console.log("[Auth] Fallback: Store hydrated, checking auth");
        checkAuth();
      } else {
        console.warn(
          "[Auth] Fallback: Store not hydrated after timeout, checking auth anyway"
        );
        // Still check auth - API client will handle missing token gracefully
        checkAuth();
      }
    }, 1000);

    return () => {
      unsub?.();
      clearTimeout(fallbackTimeout);
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
