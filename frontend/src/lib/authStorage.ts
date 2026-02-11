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

/**
 * Returns a storage adapter that delegates to getAuthStorage() on every call.
 * Use this for Zustand persist so the backend is resolved at read/write time
 * (e.g. after Capacitor is ready on native) instead of once at store creation.
 */
export function getLazyAuthStorage(): AuthStorageBackend {
  return {
    getItem(name: string): string | null | Promise<string | null> {
      return getAuthStorage().getItem(name);
    },
    setItem(name: string, value: string): void | Promise<void> {
      const result = getAuthStorage().setItem(name, value);
      return result instanceof Promise ? result : undefined;
    },
    removeItem(name: string): void | Promise<void> {
      const result = getAuthStorage().removeItem(name);
      return result instanceof Promise ? result : undefined;
    },
  };
}

/** Last setItem promise from the flush-tracking wrapper (used so login can await persist write). */
let lastAuthSetItemPromise: Promise<void> | null = null;

/**
 * Wraps a storage backend and tracks the latest setItem promise so callers can await persistence.
 */
function wrapWithFlushTracking(backend: AuthStorageBackend): AuthStorageBackend {
  return {
    getItem(name: string): string | null | Promise<string | null> {
      return backend.getItem(name);
    },
    setItem(name: string, value: string): void | Promise<void> {
      const p = Promise.resolve(backend.setItem(name, value));
      lastAuthSetItemPromise = p;
      return p;
    },
    removeItem(name: string): void | Promise<void> {
      return backend.removeItem(name);
    },
  };
}

/**
 * Returns the same as getLazyAuthStorage() but wrapped so setItem is tracked for waitForAuthFlush().
 * Use this for Zustand persist when you need to await the write after login on native.
 */
export function getLazyAuthStorageWithFlush(): AuthStorageBackend {
  return wrapWithFlushTracking(getLazyAuthStorage());
}

/**
 * Waits for the most recent auth persist write to complete.
 * Call after setToken (e.g. after login) so the token is persisted before returning.
 */
export async function waitForAuthFlush(): Promise<void> {
  const p = lastAuthSetItemPromise;
  lastAuthSetItemPromise = null;
  if (p) await p;
}
