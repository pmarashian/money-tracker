import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BackgroundId,
  DEFAULT_BACKGROUND_ID,
  getBackgroundSrc,
} from '../lib/appBackgrounds';
import { getBackgroundId, setBackgroundId as persistBackgroundId } from '../lib/backgroundStorage';

interface AppBackgroundContextValue {
  backgroundId: BackgroundId;
  backgroundSrc: string | null;
  loading: boolean;
  setBackgroundId: (id: BackgroundId) => Promise<void>;
}

const AppBackgroundContext = createContext<AppBackgroundContextValue | undefined>(undefined);

export const AppBackgroundProvider = ({ children }: { children: ReactNode }) => {
  const [backgroundId, setBackgroundIdState] = useState<BackgroundId>(DEFAULT_BACKGROUND_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBackgroundId()
      .then(setBackgroundIdState)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (backgroundId !== 'none') {
      document.body.setAttribute('data-app-background', '1');
    } else {
      document.body.removeAttribute('data-app-background');
    }
  }, [backgroundId]);

  const setBackgroundId = useCallback(async (id: BackgroundId) => {
    await persistBackgroundId(id);
    setBackgroundIdState(id);
  }, []);

  const backgroundSrc = useMemo(() => getBackgroundSrc(backgroundId), [backgroundId]);

  const value = useMemo(
    () => ({ backgroundId, backgroundSrc, loading, setBackgroundId }),
    [backgroundId, backgroundSrc, loading, setBackgroundId]
  );

  return <AppBackgroundContext.Provider value={value}>{children}</AppBackgroundContext.Provider>;
};

export function useAppBackground(): AppBackgroundContextValue {
  const ctx = useContext(AppBackgroundContext);
  if (!ctx) {
    throw new Error('useAppBackground must be used within AppBackgroundProvider');
  }
  return ctx;
}
