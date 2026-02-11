import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLazyAuthStorageWithFlush } from "../lib/authStorage";

interface AuthStore {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
  getToken: () => string | null;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,

      setToken: (token: string | null) => {
        set({ token });
      },

      clearToken: () => {
        set({ token: null });
      },

      getToken: () => {
        return get().token;
      },

      isAuthenticated: () => {
        const token = get().token;
        return token !== null && token !== "";
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => getLazyAuthStorageWithFlush()),
    }
  )
);
