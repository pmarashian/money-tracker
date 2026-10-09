import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';
import { parseDateOnlyAsLocal } from '../lib/dateUtils';
import { RrWin } from '../components/rr/RrWin';
import { RetroLoaderPage } from '../components/RetroLoaderPage';
import { useRetroPageLoading } from '../hooks/useRetroPageLoading';

const NY_TZ = 'America/New_York';

interface SnapshotAmountDate {
  amount: number;
  date: string;
}

interface MoneySnapshot {
  as_of: string;
  current_available_balance: number;
  next_bonus_date: string;
  projected_low_to_bonus: SnapshotAmountDate;
  topoff_needed_after_bonus: number;
  following_bonus_date: string;
  low_after_topoff: SnapshotAmountDate;
  status: 'on_track' | 'needs_topoff';
  topoff_needed_now: number;
  bills: unknown[];
  balance_before_next_bonus?: SnapshotAmountDate;
  min_balance?: number;
}

interface SnapshotResponse {
  snapshot: MoneySnapshot | null;
  as_of: string | null;
  received_at: string | null;
  stale: boolean;
}

const SNAPSHOT_TIMEOUT_MS = 15000;
const BALANCE_FONT_MAX_PX = 32;
const BALANCE_FONT_MIN_PX = 16;

function HomeBalanceAmount({ amount }: { amount: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      let size = BALANCE_FONT_MAX_PX;
      const applySize = (px: number) => {
        text.style.fontSize = `${px}px`;
        text.style.lineHeight = `${Math.round(px * 1.25)}px`;
      };

      applySize(size);
      while (size > BALANCE_FONT_MIN_PX && text.scrollWidth > container.clientWidth) {
        size -= 1;
        applySize(size);
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [amount]);

  return (
    <div ref={containerRef} className="home-hero-balance-fit">
      <p ref={textRef} className="home-hero-balance-fit__amount">{amount}</p>
    </div>
  );
}

const Home: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [snapshotResponse, setSnapshotResponse] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const requestIdRef = useRef(0);
  const snapshotLoadedOnceRef = useRef(false);

  /**
   * Load the snapshot. Always ends the loading state (success, error, or timeout),
   * so Home can never sit on the spinner forever.
   * NOTE: the app uses react-router <Routes>, not IonRouterOutlet, so Ionic page
   * lifecycle hooks (useIonViewWillEnter) never fire here. Refetch on route entry instead.
   */
  const loadSnapshot = useCallback(async () => {
    if (!user) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    let timeoutId = 0;
    try {
      const result = await Promise.race([
        apiGet<SnapshotResponse>('/api/snapshot'),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error('Timed out loading snapshot')),
            SNAPSHOT_TIMEOUT_MS
          );
        }),
      ]);
      if (requestId !== requestIdRef.current) return;
      if (result.ok && result.data) {
        setSnapshotResponse(result.data);
      } else if (result.status === 401) {
        setError('Authentication required');
      } else {
        setError(result.error || 'Failed to load snapshot');
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (requestId === requestIdRef.current) {
        setLoading(false);
        snapshotLoadedOnceRef.current = true;
      }
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (location.pathname === '/app/home') {
      void loadSnapshot();
    }
  }, [user, authLoading, location.pathname, loadSnapshot]);

  useEffect(() => {
    if (!user) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (location.pathname !== '/app/home') return;
      if (!snapshotLoadedOnceRef.current) return;
      void loadSnapshot();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user, location.pathname, loadSnapshot]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatShortDate = (dateStr: string) => {
    const d = parseDateOnlyAsLocal(dateStr);
    return d
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : dateStr;
  };

  const formatAsOfNy = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      timeZone: NY_TZ,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const statusLabel = (status: MoneySnapshot['status']) =>
    status === 'on_track' ? 'On track' : 'Needs top-off';

  const pageLoading = authLoading || loading;
  const { showLoader, blocking: loadingBlocking } = useRetroPageLoading(pageLoading);

  if (loadingBlocking) {
    return (
      <RetroLoaderPage
        title="Money Tracker"
        label="LOADING SNAPSHOT"
        showLoader={showLoader}
      />
    );
  }

  if (!user) {
    return (
      <IonPage className="rr-app">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p className="rr-lead">Please log in to view your finances.</p>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage className="rr-app">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <RrWin tag="ERROR">
            <p className="rr-danger rr-fs-m">{error}</p>
            <IonButton expand="block" onClick={() => void loadSnapshot()}>
              Retry
            </IonButton>
          </RrWin>
        </IonContent>
      </IonPage>
    );
  }

  const snapshot = snapshotResponse?.snapshot;

  if (!snapshot) {
    return (
      <IonPage className="rr-app">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <RrWin tag="HOME">
            <p className="rr-lead">
              Your assistant has not pushed a financial snapshot yet. Once the first push lands,
              your key balances will show here.
            </p>
            <IonButton expand="block" onClick={() => void loadSnapshot()}>
              Refresh
            </IonButton>
          </RrWin>
        </IonContent>
      </IonPage>
    );
  }

  const asOfDisplay = snapshotResponse?.as_of ?? snapshot.as_of;
  const showTopoffNow = snapshot.topoff_needed_now > 0;
  const beforeBonus = snapshot.balance_before_next_bonus;
  const statusClass =
    snapshot.status === 'on_track' ? 'home-snapshot__status--ok' : 'home-snapshot__status--warn';

  return (
    <IonPage className="rr-app">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="home-content">
        <div className="home-snapshot rr-stack">
          {snapshotResponse?.stale && (
            <RrWin tag="STALE">
              <p className="rr-lead">
                Snapshot is over 3 days old (as of {formatAsOfNy(asOfDisplay)}). Ask your assistant
                to push an update.
              </p>
            </RrWin>
          )}

          <div className="home-snapshot__status-row">
            <span className="home-snapshot__status-label">Status</span>
            <span className={`home-snapshot__status-tag ${statusClass}`}>
              {statusLabel(snapshot.status)}
            </span>
          </div>

          {beforeBonus && (
            <RrWin tag="BALANCE" className="home-hero-win home-hero-win--balance">
              <p className="rr-hero-label">
                Before next bonus · {formatShortDate(beforeBonus.date)}
              </p>
              <HomeBalanceAmount amount={formatCurrency(beforeBonus.amount)} />
            </RrWin>
          )}

          {showTopoffNow && (
            <RrWin tag="TOP OFF" className="home-hero-win home-hero-win--topoff">
              <p className="rr-hero-label">
                Top off by {formatShortDate(snapshot.projected_low_to_bonus.date)}
              </p>
              <p className="rr-hero-value">{formatCurrency(snapshot.topoff_needed_now)}</p>
            </RrWin>
          )}

          <p className="home-snapshot__updated">
            Updated {formatAsOfNy(asOfDisplay)} (New York)
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
