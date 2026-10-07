import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  BackgroundId,
  DEFAULT_BACKGROUND_ID,
  isBackgroundId,
} from './appBackgrounds';

const STORAGE_KEY = 'app-background-id';

async function readFromPreferences(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    return value;
  } catch {
    return null;
  }
}

async function writeToPreferences(id: BackgroundId): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: STORAGE_KEY, value: id });
  } catch {
    // fall through to localStorage
  }
}

export async function getBackgroundId(): Promise<BackgroundId> {
  const fromPrefs = await readFromPreferences();
  if (isBackgroundId(fromPrefs)) return fromPrefs;

  if (typeof window !== 'undefined') {
    const fromLs = window.localStorage.getItem(STORAGE_KEY);
    if (isBackgroundId(fromLs)) return fromLs;
  }

  return DEFAULT_BACKGROUND_ID;
}

export async function setBackgroundId(id: BackgroundId): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  await writeToPreferences(id);
}
