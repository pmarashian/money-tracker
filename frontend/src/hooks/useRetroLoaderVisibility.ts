import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_DELAY_MS = 150;
const DEFAULT_MIN_VISIBLE_MS = 1000;
/**
 * If another loader instance was on screen within this window, the next one shows
 * immediately (no delay gap) and continues the same "session". This covers handoffs
 * between stacked gates (InitialRoute -> ProtectedRoute -> page), which are separate
 * component instances and used to blink: loader, blank, loader.
 */
const HANDOFF_WINDOW_MS = 100;

export type RetroLoaderVisibilityOptions = {
  delayMs?: number;
  minVisibleMs?: number;
};

/** Shared across all loader instances so handoffs don't restart the delay/min clock. */
const loaderSession = {
  activeCount: 0,
  /** When the current on-screen loader session started (ms epoch), or null. */
  sessionStartedAt: null as number | null,
  /** Last time any loader instance hid (ms epoch). */
  lastHiddenAt: 0,
};

function now(): number {
  return Date.now();
}

function beginShow(): number {
  const t = now();
  if (
    loaderSession.sessionStartedAt === null ||
    (loaderSession.activeCount === 0 && t - loaderSession.lastHiddenAt > HANDOFF_WINDOW_MS)
  ) {
    loaderSession.sessionStartedAt = t;
  }
  loaderSession.activeCount += 1;
  return loaderSession.sessionStartedAt;
}

function endShow(): void {
  loaderSession.activeCount = Math.max(0, loaderSession.activeCount - 1);
  loaderSession.lastHiddenAt = now();
  // sessionStartedAt is kept so an immediate handoff resumes it; beginShow resets it when stale.
}

function isHandoff(): boolean {
  return (
    loaderSession.activeCount > 0 || now() - loaderSession.lastHiddenAt <= HANDOFF_WINDOW_MS
  );
}

/** Test helper. */
export function __resetRetroLoaderSessionForTests(): void {
  loaderSession.activeCount = 0;
  loaderSession.sessionStartedAt = null;
  loaderSession.lastHiddenAt = 0;
}

/**
 * Delays showing the loader to avoid flicker on fast loads (never shows if loading
 * finishes within `delayMs`), and once shown keeps it on screen for at least
 * `minVisibleMs` measured from when the loader session first appeared.
 * Re-entering loading while already visible keeps it visible (no blink).
 */
export function useRetroLoaderVisibility(
  loading: boolean,
  options?: RetroLoaderVisibilityOptions
): boolean {
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const minVisibleMs = options?.minVisibleMs ?? DEFAULT_MIN_VISIBLE_MS;
  const [visible, setVisible] = useState<boolean>(() => loading && isHandoff());
  const shownAtRef = useRef<number | null>(null);
  const registeredRef = useRef(false);

  // Register an initial handoff-visible state (layout effect: before paint, StrictMode-safe).
  useLayoutEffect(() => {
    if (visible && !registeredRef.current) {
      registeredRef.current = true;
      shownAtRef.current = beginShow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) {
      if (visible) return; // already on screen: keep it, no reset
      const delayTimer = window.setTimeout(
        () => {
          if (!registeredRef.current) {
            registeredRef.current = true;
            shownAtRef.current = beginShow();
          }
          setVisible(true);
        },
        isHandoff() ? 0 : delayMs
      );
      return () => window.clearTimeout(delayTimer);
    }

    if (!visible) return;

    const sessionStart =
      loaderSession.sessionStartedAt ?? shownAtRef.current ?? now();
    const remaining = Math.max(0, minVisibleMs - (now() - sessionStart));
    const hideTimer = window.setTimeout(() => {
      if (registeredRef.current) {
        registeredRef.current = false;
        endShow();
      }
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
    return () => window.clearTimeout(hideTimer);
  }, [loading, delayMs, minVisibleMs, visible]);

  // Unmount while visible (gate handing off to the next screen): release the session.
  useEffect(
    () => () => {
      if (registeredRef.current) {
        registeredRef.current = false;
        endShow();
      }
    },
    []
  );

  return visible;
}
