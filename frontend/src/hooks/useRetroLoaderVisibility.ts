import { useEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 150;
const DEFAULT_MIN_VISIBLE_MS = 1000;

export type RetroLoaderVisibilityOptions = {
  delayMs?: number;
  minVisibleMs?: number;
};

/**
 * Delays showing the loader to avoid flicker on fast loads, and keeps it visible
 * for a minimum duration once shown.
 */
export function useRetroLoaderVisibility(
  loading: boolean,
  options?: RetroLoaderVisibilityOptions
): boolean {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const minVisibleMs = options?.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading) {
      setVisible(false);
      shownAtRef.current = null;
      const delayTimer = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => window.clearTimeout(delayTimer);
    }

    if (!visible) {
      shownAtRef.current = null;
      return;
    }

    const shownAt = shownAtRef.current ?? Date.now();
    const remaining = Math.max(0, minVisibleMs - (Date.now() - shownAt));
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      shownAtRef.current = null;
    }, remaining);
    return () => window.clearTimeout(hideTimer);
  }, [loading, delayMs, minVisibleMs, visible]);

  return visible;
}
