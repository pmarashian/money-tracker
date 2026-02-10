/**
 * Storage backend for auth persist (Zustand).
 * On native (Capacitor iOS/Android), uses Preferences so the token survives force-close.
 * On web, uses localStorage.
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export type AuthStorageBackend = {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
};

function webStorage(): AuthStorageBackend {
  return {
    getItem: (name: string) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(name);
    },
    setItem: (name: string, value: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(name, value);
    },
    removeItem: (name: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(name);
    },
  };
}

function nativeStorage(): AuthStorageBackend {
  return {
    getItem: async (name: string) => {
      const { value } = await Preferences.get({ key: name });
      return value ?? null;
    },
    setItem: (name: string, value: string) =>
      Preferences.set({ key: name, value }),
    removeItem: (name: string) => Preferences.remove({ key: name }),
  };
}

/**
 * Returns the storage backend for auth state.
 * Native: Capacitor Preferences (persists across force-close on iOS/Android).
 * Web: localStorage.
 */
export function getAuthStorage(): AuthStorageBackend {
  if (Capacitor.isNativePlatform()) {
    return nativeStorage();
  }
  return webStorage();
}
