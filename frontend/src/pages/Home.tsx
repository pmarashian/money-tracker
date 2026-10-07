import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonBadge,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';
import { parseDateOnlyAsLocal } from '../lib/dateUtils';

const NY_TZ = 'America/New_York';

interface SnapshotBill {
  name: string;
  amount: number;
  frequency: string;
  next_date: string;
}

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
  bills: SnapshotBill[];
}

interface SnapshotResponse {
  snapshot: MoneySnapshot | null;
  as_of: string | null;
  received_at: string | null;
  stale: boolean;
}

const Stat: React.FC<{ label: string; value: string; primary?: boolean }> = ({
  label,
  value,
  primary,
}) => (
  <div className={`home-stat${primary ? ' home-stat--primary' : ''}`}>
    <div className="home-stat__label">{label}</div>
    <div className="home-stat__value">{value}</div>
  </div>
);

const Home: React.FC = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [snapshotResponse, setSnapshotResponse] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshot = async () => {
    const result = await apiGet<SnapshotResponse>('/api/snapshot');
    if (result.ok && result.data) {
      setSnapshotResponse(result.data);
    } else if (result.status === 401) {
      setError('Authentication required');
    } else {
      setError(result.error || 'Failed to load snapshot');
    }
  };

  useEffect(() => {
    if (user && location.pathname === '/app/home') {
      setLoading(true);
      setError(null);
      fetchSnapshot().finally(() => setLoading(false));
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, location.pathname]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDateOnly = (dateStr: string) => {
    const d = parseDateOnlyAsLocal(dateStr);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : dateStr;
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

  const statusColor = (status: MoneySnapshot['status']) =>
    status === 'on_track' ? 'success' : 'warning';

  const statusLabel = (status: MoneySnapshot['status']) =>
    status === 'on_track' ? 'On track' : 'Needs top-off';

  if (authLoading || loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="crescent" />
          <IonText color="medium">
            <p>Loading your snapshot...</p>
          </IonText>
        </IonContent>
      </IonPage>
    );
  }

  if (!user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p className="font-body">Please log in to view your finances.</p>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonCard color="danger">
            <IonCardContent>
              <IonText color="danger">
                <p>{error}</p>
              </IonText>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  const snapshot = snapshotResponse?.snapshot;

  if (!snapshot) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonCard color="medium">
            <IonCardHeader>
              <IonCardTitle>No snapshot yet</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p className="font-body">
                Your assistant has not pushed a financial snapshot yet. Once the first push
                lands, your key balances will show here.
              </p>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  const asOfDisplay = snapshotResponse?.as_of ?? snapshot.as_of;
  const showTopoffNow = snapshot.topoff_needed_now > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding home-snapshot">
          {snapshotResponse?.stale && (
            <IonCard color="warning" className="home-snapshot__stale">
              <IonCardContent>
                <IonText>
                  <p className="font-body">
                    Snapshot is over 3 days old (as of {formatAsOfNy(asOfDisplay)}). Ask your
                    assistant to push an update.
                  </p>
                </IonText>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard className="home-snapshot__card">
            <IonCardContent>
              <div className="home-snapshot__status-row">
                <span className="home-stat__label">Status</span>
                <IonBadge color={statusColor(snapshot.status)}>{statusLabel(snapshot.status)}</IonBadge>
              </div>

              <Stat
                label="Chase available"
                value={formatCurrency(snapshot.current_available_balance)}
                primary
              />

              {showTopoffNow && (
                <Stat
                  label={`Top off by ${formatDateOnly(snapshot.projected_low_to_bonus.date)}`}
                  value={formatCurrency(snapshot.topoff_needed_now)}
                />
              )}

              <Stat
                label={`Projected low · ${formatDateOnly(snapshot.projected_low_to_bonus.date)}`}
                value={formatCurrency(snapshot.projected_low_to_bonus.amount)}
              />

              <Stat
                label="Next bonus"
                value={formatDateOnly(snapshot.next_bonus_date)}
              />

              <p className="home-snapshot__updated">
                Updated {formatAsOfNy(asOfDisplay)} (New York)
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
