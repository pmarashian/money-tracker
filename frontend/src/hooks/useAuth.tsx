import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { apiGet, apiPost } from "../lib/api";
import { getAuthToken, setAuthToken, clearAuthToken } from "../lib/authStorage";
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
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (
    newPassword: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    await logger.info(
      "[Auth] checkAuth called - starting authentication check",
    );

    try {
      const token = await getAuthToken();
      await logger.info("[Auth] Token retrieved from storage", {
        tokenPresent: !!token,
        tokenLength: token?.length ?? 0,
      });

      if (!token) {
        // No token - user is not authenticated
        await logger.info("[Auth] No token found - user not authenticated");
        setUser(null);
        setLoading(false);
        return;
      }

      // Validate token with backend
      await logger.info("[Auth] Validating token with backend");
      const result = await apiGet<{ user: User }>("/api/auth/session");

      if (result.ok && result.data?.user) {
        await logger.info(
          "[Auth] Session check successful - user authenticated",
          {
            userId: result.data.user.id,
            email: result.data.user.email,
            status: result.status,
          },
        );
        setUser(result.data.user);
      } else {
        await logger.warn("[Auth] Session check failed", {
          status: result.status,
          error: result.error,
          ok: result.ok,
        });

        // Only clear token if we're sure it's invalid (401)
        if (result.status === 401) {
          // Token was sent but rejected - clear it
          await logger.info("[Auth] Token invalid (401) - clearing token");
          await clearAuthToken();
          setUser(null);
        } else {
          // Other error - might be network issue, don't clear token
          await logger.info(
            "[Auth] Non-401 error - keeping token (may be network issue)",
            {
              status: result.status,
            },
          );
          setUser(null);
        }
      }
    } catch (error: any) {
      await logger.error("[Auth] Session check exception", {
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
      });
      // Don't clear token on network errors
      setUser(null);
    } finally {
      setLoading(false);
      // await logger.info("[Auth] checkAuth completed", {
      //   userAuthenticated: !!user,
      //   loading: false,
      // });
    }
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    // await logger.info("[Auth] Login attempt initiated", {
    //   email,
    // });

    try {
      const result = await apiPost<{ token?: string; user?: User }>(
        "/api/auth/login",
        { email, password },
      );

      if (result.ok && result.data?.token) {
        // await logger.info("[Auth] Login successful - saving token", {
        //   email,
        //   tokenLength: result.data.token.length,
        //   hasUser: !!result.data.user,
        // });

        // Save token to storage
        await setAuthToken(result.data.token);
        // await logger.info("[Auth] Token saved successfully");

        // Set user from login response
        if (result.data.user) {
          setUser(result.data.user);
          // await logger.info("[Auth] User state updated", {
          //   userId: result.data.user.id,
          //   email: result.data.user.email,
          // });
        }

        setLoading(false);
        return { success: true };
      }

      await logger.warn("[Auth] Login failed", {
        email,
        status: result.status,
        error: result.error,
        ok: result.ok,
        hasToken: !!result.data?.token,
      });

      return { success: false, error: result.error || "Login failed" };
    } catch (error: any) {
      await logger.error("[Auth] Login exception", {
        email,
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  };

  const logout = async () => {
    // await logger.info("[Auth] Logout initiated", {
    //   userId: user?.id,
    //   email: user?.email,
    // });

    try {
      await apiPost("/api/auth/logout");
      // await logger.info("[Auth] Logout API call successful");
    } catch (error: any) {
      await logger.error("[Auth] Logout API call failed", {
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
      });
    } finally {
      // await logger.info("[Auth] Clearing token and user state");
      await clearAuthToken();
      setUser(null);
      // await logger.info(
      //   "[Auth] Logout completed - token cleared, user state reset",
      // );
    }
  };

  const changePassword = async (
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    await logger.info("[Auth] Password change initiated", {
      userId: user?.id,
      email: user?.email,
    });

    try {
      const result = await apiPost<{ success?: boolean; message?: string }>(
        "/api/auth/change-password",
        { newPassword },
      );

      if (result.ok && result.data?.success) {
        await logger.info("[Auth] Password change successful", {
          userId: user?.id,
          email: user?.email,
        });
        return { success: true };
      }

      await logger.warn("[Auth] Password change failed", {
        userId: user?.id,
        email: user?.email,
        status: result.status,
        error: result.error,
        ok: result.ok,
      });

      return {
        success: false,
        error: result.error || "Password change failed",
      };
    } catch (error: any) {
      await logger.error("[Auth] Password change exception", {
        userId: user?.id,
        email: user?.email,
        error: error.message,
        errorStack: error.stack,
        errorName: error.name,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  };

  // Initialize: load token and validate on mount
  useEffect(() => {
    // logger.info("[Auth] AuthProvider mounted - initializing authentication check");
    checkAuth();

    return () => {
      // logger.info("[Auth] AuthProvider unmounting");
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, checkAuth, logout, changePassword }}
    >
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
