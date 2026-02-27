/**
 * Auth token storage utilities.
 * On native (Capacitor iOS/Android), uses Preferences so the token survives force-close.
 * On web, uses localStorage.
 * Falls back to localStorage if Preferences is not available (e.g., plugin not implemented).
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import logger from "./logger";

const STORAGE_KEY = "auth-token";

/**
 * Check if Preferences plugin is available and working.
 * Returns true if plugin is available, false otherwise.
 */
async function isPreferencesAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    // Try a simple operation to verify plugin is available
    await Preferences.keys();
    return true;
  } catch (error: any) {
    await logger.warn(
      "[AuthStorage] Preferences plugin availability check failed",
      {
        errorCode: error?.code,
        errorMessage: error?.message,
        errorName: error?.name,
        errorStack: error?.stack,
        platform: Capacitor.getPlatform(),
      },
    );
    return false;
  }
}

/**
 * Get the auth token from storage.
 * Returns null if no token exists.
 * Falls back to localStorage if Preferences is not available.
 */
export async function getAuthToken(): Promise<string | null> {
  const platform = Capacitor.isNativePlatform() ? "native" : "web";
  const platformName = Capacitor.getPlatform();
  // await logger.info("[AuthStorage] getAuthToken called", { platform, platformName });

  try {
    // Try Preferences first if on native platform
    if (Capacitor.isNativePlatform()) {
      const preferencesAvailable = await isPreferencesAvailable();

      if (preferencesAvailable) {
        try {
          const { value } = await Preferences.get({ key: STORAGE_KEY });
          const tokenExists = value !== null && value !== undefined;
          // await logger.info("[AuthStorage] Retrieved token from Preferences", {
          //   platform: "native",
          //   platformName,
          //   storageMethod: "Preferences",
          //   tokenExists,
          //   tokenLength: value?.length ?? 0,
          // });
          return value ?? null;
        } catch (error: any) {
          // Log detailed error information for diagnostics
          await logger.error(
            "[AuthStorage] Preferences.get failed despite availability check",
            {
              platform: "native",
              platformName,
              storageMethod: "Preferences",
              errorMessage: error?.message,
              errorCode: error?.code,
              errorName: error?.name,
              errorStack: error?.stack,
              errorString: String(error),
            },
          );
          // Fall through to localStorage
        }
      } else {
        await logger.warn(
          "[AuthStorage] Preferences plugin not available, skipping Preferences attempt",
          {
            platform: "native",
            platformName,
          },
        );
        // Fall through to localStorage
      }
    }

    // Web or Preferences unavailable: use localStorage
    if (typeof window === "undefined") {
      await logger.warn(
        "[AuthStorage] window is undefined, cannot retrieve token",
        {
          platform,
          storageMethod: "localStorage",
        },
      );
      return null;
    }

    const value = window.localStorage.getItem(STORAGE_KEY);
    const tokenExists = value !== null;
    // await logger.info("[AuthStorage] Retrieved token from localStorage", {
    //   platform,
    //   platformName,
    //   storageMethod: "localStorage",
    //   tokenExists,
    //   tokenLength: value?.length ?? 0,
    //   warning: Capacitor.isNativePlatform() ? "Using localStorage on native platform - tokens may not persist after force-close. Ensure Preferences plugin is properly synced." : undefined,
    // });
    return value;
  } catch (error: any) {
    await logger.error("[AuthStorage] Failed to get token", {
      platform,
      error: error.message,
      errorStack: error.stack,
    });
    return null;
  }
}

/**
 * Set the auth token in storage.
 * On native platforms with Preferences available, this persists across app force-close.
 * Falls back to localStorage if Preferences is not available.
 */
export async function setAuthToken(token: string): Promise<void> {
  const platform = Capacitor.isNativePlatform() ? "native" : "web";
  const platformName = Capacitor.getPlatform();
  // await logger.info("[AuthStorage] setAuthToken called", {
  //   platform,
  //   platformName,
  //   tokenLength: token.length,
  // });

  try {
    // Try Preferences first if on native platform
    if (Capacitor.isNativePlatform()) {
      const preferencesAvailable = await isPreferencesAvailable();

      if (preferencesAvailable) {
        try {
          await Preferences.set({ key: STORAGE_KEY, value: token });
          // await logger.info(
          //   "[AuthStorage] Token saved successfully to Preferences",
          //   {
          //     platform: "native",
          //     platformName,
          //     storageMethod: "Preferences",
          //     tokenLength: token.length,
          //   },
          // );
          return;
        } catch (error: any) {
          // Log detailed error information for diagnostics
          await logger.error(
            "[AuthStorage] Preferences.set failed despite availability check",
            {
              platform: "native",
              platformName,
              storageMethod: "Preferences",
              errorMessage: error?.message,
              errorCode: error?.code,
              errorName: error?.name,
              errorStack: error?.stack,
              errorString: String(error),
              tokenLength: token.length,
            },
          );
          // Fall through to localStorage
        }
      } else {
        await logger.warn(
          "[AuthStorage] Preferences plugin not available, skipping Preferences attempt",
          {
            platform: "native",
            platformName,
          },
        );
        // Fall through to localStorage
      }
    }

    // Web or Preferences unavailable: use localStorage
    if (typeof window === "undefined") {
      const error = new Error("Cannot set token: window is undefined");
      await logger.error(
        "[AuthStorage] Cannot set token: window is undefined",
        {
          platform,
          storageMethod: "localStorage",
        },
      );
      throw error;
    }

    window.localStorage.setItem(STORAGE_KEY, token);
    // await logger.info(
    //   "[AuthStorage] Token saved successfully to localStorage",
    //   {
    //     platform,
    //     platformName,
    //     storageMethod: "localStorage",
    //     tokenLength: token.length,
    //     warning: Capacitor.isNativePlatform()
    //       ? "Using localStorage on native platform - tokens may not persist after force-close. Ensure Preferences plugin is properly synced."
    //       : undefined,
    //   },
    // );
  } catch (error: any) {
    await logger.error("[AuthStorage] Failed to set token", {
      platform,
      error: error.message,
      errorStack: error.stack,
      tokenLength: token.length,
    });
    throw error;
  }
}

/**
 * Clear the auth token from storage.
 * Falls back to localStorage if Preferences is not available.
 */
export async function clearAuthToken(): Promise<void> {
  const platform = Capacitor.isNativePlatform() ? "native" : "web";
  const platformName = Capacitor.getPlatform();
  await logger.info("[AuthStorage] clearAuthToken called", {
    platform,
    platformName,
  });

  try {
    // Try Preferences first if on native platform
    if (Capacitor.isNativePlatform()) {
      const preferencesAvailable = await isPreferencesAvailable();

      if (preferencesAvailable) {
        try {
          await Preferences.remove({ key: STORAGE_KEY });
          // await logger.info(
          //   "[AuthStorage] Token cleared successfully from Preferences",
          //   {
          //     platform: "native",
          //     platformName,
          //     storageMethod: "Preferences",
          //   },
          // );
          return;
        } catch (error: any) {
          // Log detailed error information for diagnostics
          await logger.error(
            "[AuthStorage] Preferences.remove failed despite availability check",
            {
              platform: "native",
              platformName,
              storageMethod: "Preferences",
              errorMessage: error?.message,
              errorCode: error?.code,
              errorName: error?.name,
              errorStack: error?.stack,
              errorString: String(error),
            },
          );
          // Fall through to localStorage
        }
      } else {
        await logger.warn(
          "[AuthStorage] Preferences plugin not available, skipping Preferences attempt",
          {
            platform: "native",
            platformName,
          },
        );
        // Fall through to localStorage
      }
    }

    // Web or Preferences unavailable: use localStorage
    if (typeof window === "undefined") {
      await logger.warn(
        "[AuthStorage] window is undefined, cannot clear token",
        {
          platform,
          storageMethod: "localStorage",
        },
      );
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    // await logger.info(
    //   "[AuthStorage] Token cleared successfully from localStorage",
    //   {
    //     platform,
    //     storageMethod: "localStorage",
    //   },
    // );
  } catch (error: any) {
    await logger.error("[AuthStorage] Failed to clear token", {
      platform,
      error: error.message,
      errorStack: error.stack,
    });
    // Don't throw - clearing is best-effort
  }
}
