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
  IonButton,
  IonIcon,
} from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { calendarOutline, settingsOutline } from 'ionicons/icons';
import { apiGet } from '../lib/api';

interface HealthData {
  status: 'not_enough' | 'enough' | 'too_much';
  projectedBalance: number;
  breakdown: {
    inflows: {
      payroll: number;
      bonus: number;
      total: number;
    };
    outflows: {
      recurring: number;
      total: number;
    };
    netFlow: number;
  };
  projectionPeriodDays: number;
  currentBalance?: number;
  nextPaycheckDate?: string | null;
}

interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string;
  bonusAmount?: number;
  nextPaycheckDate?: string;
}

const Home: React.FC = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      const response = await apiGet('/api/health');

      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
      } else if (response.status === 401) {
        setError('Authentication required');
      } else {
        setError('Failed to load health data');
      }
    } catch (err) {
      console.error('Error fetching health data:', err);
      setError('Network error');
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await apiGet('/api/settings');

      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    if (user && location.pathname === '/app/home') {
      setLoading(true);
      setError(null);
      Promise.all([fetchHealthData(), fetchSettings()]).finally(() => {
        setLoading(false);
      });
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, location.pathname]);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'not_enough':
        return 'danger';
      case 'enough':
        return 'success';
      case 'too_much':
        return 'warning';
      default:
        return 'medium';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getNextPaycheckDate = (): Date | null => {
    if (!settings?.paycheckAmount) return null;
    const dateStr = healthData?.nextPaycheckDate ?? settings?.nextPaycheckDate;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    const today = new Date();
    return new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  };

  const getDaysUntilBonus = () => {
    if (!settings?.nextBonusDate) return null;

    const today = new Date();
    const bonusDate = new Date(settings.nextBonusDate);
    const diffTime = bonusDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : null;
  };

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
            <p>Loading your financial health...</p>
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
          <p className="font-body">Please log in to view your financial health.</p>
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
                <p>Error loading financial health: {error}</p>
              </IonText>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonPage>
    );
  }

  const hasSettings = settings && settings.paycheckAmount > 0;
  const nextPaycheckDate = getNextPaycheckDate();
  const daysUntilBonus = getDaysUntilBonus();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          {!hasSettings ? (
            <IonCard color="warning">
              <IonCardHeader>
                <IonCardTitle>Setup Required</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p className="font-body">
                  Set up your income and balance information to see your financial health.
                </p>
                <IonButton
                  fill="clear"
                  routerLink="/app/settings"
                  color="primary"
                >
                  <IonIcon slot="start" icon={settingsOutline} />
                  Go to Settings
                </IonButton>
              </IonCardContent>
            </IonCard>
          ) : healthData ? (
            <>
              {/* Hero: card background = state (danger/success/warning), projected balance + supporting line */}
              <IonCard className="home-hero" color={getHealthStatusColor(healthData.status)}>
                <IonCardContent>
                  {(healthData.currentBalance !== undefined || settings?.balance !== undefined) && (
                    <p className="home-hero__supporting" style={{ marginBottom: '0.5rem' }}>
                      Current balance: {formatCurrency(healthData.currentBalance ?? settings?.balance ?? 0)}
                    </p>
                  )}
                  <div className="home-hero__balance">
                    <span className="home-hero__balance-label">
                      Balance in {healthData.projectionPeriodDays} days
                    </span>
                    <span className="home-hero__balance-value">
                      {formatCurrency(healthData.projectedBalance)}
                    </span>
                  </div>
                  <p className="home-hero__supporting">
                    Based on {healthData.projectionPeriodDays}-day projection · Net flow: {formatCurrency(healthData.breakdown.netFlow)}
                  </p>
                  <p className="home-hero__supporting">
                    Expenses: {formatCurrency(healthData.breakdown.outflows.total)}
                    {' · Payroll: '}
                    {formatCurrency(healthData.breakdown.inflows.payroll)}
                    {healthData.breakdown.inflows.bonus > 0
                      ? ` · Bonus: ${formatCurrency(healthData.breakdown.inflows.bonus)}`
                      : ''}
                  </p>
                </IonCardContent>
              </IonCard>

              {/* Upcoming: paycheck + bonus in compact rows */}
              <IonCard className="home-upcoming">
                <IonCardContent>
                  {nextPaycheckDate && (
                    <div className="home-upcoming__row">
                      <span className="home-upcoming__label">
                        <IonIcon icon={calendarOutline} className="home-upcoming__icon" />
                        Next paycheck
                      </span>
                      <span className="home-upcoming__value">{nextPaycheckDate.toLocaleDateString()}</span>
                    </div>
                  )}
                  {daysUntilBonus != null && daysUntilBonus > 0 && (
                    <div className="home-upcoming__row">
                      <span className="home-upcoming__label">
                        <IonIcon icon={calendarOutline} className="home-upcoming__icon" />
                        Bonus
                      </span>
                      <span className="home-upcoming__value">
                        {daysUntilBonus} days
                        {settings?.bonusAmount ? ` · ${formatCurrency(settings.bonusAmount)}` : ''}
                      </span>
                    </div>
                  )}
                  {!nextPaycheckDate && (daysUntilBonus == null || daysUntilBonus <= 0) && (
                    <p className="home-upcoming__empty font-body">
                      No upcoming income events
                    </p>
                  )}
                </IonCardContent>
              </IonCard>
            </>
          ) : (
            <IonCard color="medium">
              <IonCardContent>
                <IonText color="medium">
                  <p>No health data available. Upload transactions to see your financial health.</p>
                </IonText>
              </IonCardContent>
            </IonCard>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;