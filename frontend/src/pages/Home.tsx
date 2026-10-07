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
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonNote,
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
    return d ? d.toLocaleDateString('en-US', { timeZone: NY_TZ }) : dateStr;
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
                lands, balances and bills will show here.
              </p>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  const asOfDisplay = snapshotResponse?.as_of ?? snapshot.as_of;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          {snapshotResponse?.stale && (
            <IonCard color="warning">
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

          <IonCard className="home-hero" color={statusColor(snapshot.status)}>
            <IonCardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="home-hero__balance-label">Status</span>
                <IonBadge color={statusColor(snapshot.status)} style={{ fontSize: '1rem', padding: '8px 12px' }}>
                  {statusLabel(snapshot.status)}
                </IonBadge>
              </div>
              {snapshot.status === 'needs_topoff' && snapshot.topoff_needed_now > 0 && (
                <div className="home-hero__balance" style={{ marginTop: '0.75rem' }}>
                  <span className="home-hero__balance-label">Add now</span>
                  <span className="home-hero__balance-value">{formatCurrency(snapshot.topoff_needed_now)}</span>
                </div>
              )}
              <p className="home-hero__supporting" style={{ marginTop: '0.75rem' }}>
                Available: {formatCurrency(snapshot.current_available_balance)}
              </p>
              <p className="home-hero__supporting">
                Updated {formatAsOfNy(asOfDisplay)} (New York)
              </p>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Through next bonus</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="home-upcoming__row">
                <span className="home-upcoming__label">Projected low</span>
                <span className="home-upcoming__value">
                  {formatCurrency(snapshot.projected_low_to_bonus.amount)} on{' '}
                  {formatDateOnly(snapshot.projected_low_to_bonus.date)}
                </span>
              </div>
              <div className="home-upcoming__row">
                <span className="home-upcoming__label">Next bonus</span>
                <span className="home-upcoming__value">{formatDateOnly(snapshot.next_bonus_date)}</span>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>After next bonus</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="home-upcoming__row">
                <span className="home-upcoming__label">Top-off needed</span>
                <span className="home-upcoming__value">
                  {formatCurrency(snapshot.topoff_needed_after_bonus)}
                </span>
              </div>
              <div className="home-upcoming__row">
                <span className="home-upcoming__label">Following bonus</span>
                <span className="home-upcoming__value">
                  {formatDateOnly(snapshot.following_bonus_date)}
                </span>
              </div>
              <div className="home-upcoming__row">
                <span className="home-upcoming__label">Low after top-off</span>
                <span className="home-upcoming__value">
                  {formatCurrency(snapshot.low_after_topoff.amount)} on{' '}
                  {formatDateOnly(snapshot.low_after_topoff.date)}
                </span>
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Upcoming bills</IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: 0 }}>
              {snapshot.bills.length === 0 ? (
                <p className="ion-padding font-body">No bills in this snapshot.</p>
              ) : (
                <IonList lines="full">
                  {snapshot.bills.map((bill) => (
                    <IonItem key={`${bill.name}-${bill.next_date}`}>
                      <IonLabel>
                        <h2>{bill.name}</h2>
                        <p>{bill.frequency}</p>
                      </IonLabel>
                      <IonNote slot="end" className="ion-text-end">
                        <div>{formatCurrency(bill.amount)}</div>
                        <div>{formatDateOnly(bill.next_date)}</div>
                      </IonNote>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;
