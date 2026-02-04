import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonBadge,
  IonSpinner,
  IonText,
  IonButton,
  IonIcon,
} from '@ionic/react';
import { useAuth } from '../hooks/useAuth';
import { cashOutline, calendarOutline, settingsOutline } from 'ionicons/icons';
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
}

interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string;
  bonusAmount?: number;
}

const Home: React.FC = () => {
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
    if (user) {
      setLoading(true);
      setError(null);
      Promise.all([fetchHealthData(), fetchSettings()]).finally(() => {
        setLoading(false);
      });
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

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

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'not_enough':
        return 'Not Enough';
      case 'enough':
        return 'Enough';
      case 'too_much':
        return 'Too Much';
      default:
        return 'Unknown';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getNextPaycheckDate = () => {
    if (!settings?.paycheckAmount) return null;

    // Assume bi-weekly paychecks for now
    const today = new Date();
    const nextPaycheck = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    return nextPaycheck;
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
            <IonMenuButton slot="start" />
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
            <IonMenuButton slot="start" />
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <h1 className="font-heading">Welcome to Money Tracker</h1>
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
            <IonMenuButton slot="start" />
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
          <IonMenuButton slot="start" />
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-padding">
          <h1 className="font-heading">Financial Health</h1>

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
              {/* Health Status */}
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Health Status</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <IonBadge color={getHealthStatusColor(healthData.status)}>
                      {getHealthStatusText(healthData.status)}
                    </IonBadge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <IonIcon icon={cashOutline} />
                    <IonText>
                      <strong>Projected Balance: {formatCurrency(healthData.projectedBalance)}</strong>
                    </IonText>
                  </div>

                  <div className="font-body" style={{ fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
                    <p>
                      Based on {healthData.projectionPeriodDays}-day projection with {formatCurrency(healthData.breakdown.netFlow)} net flow.
                    </p>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* Summary Information */}
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>Summary</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {nextPaycheckDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <IonIcon icon={calendarOutline} />
                        <IonText>
                          Next paycheck: {nextPaycheckDate.toLocaleDateString()}
                        </IonText>
                      </div>
                    )}

                    {daysUntilBonus && daysUntilBonus > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <IonIcon icon={calendarOutline} />
                        <IonText>
                          {daysUntilBonus} days until bonus
                          {settings?.bonusAmount && ` (${formatCurrency(settings.bonusAmount)})`}
                        </IonText>
                      </div>
                    )}

                    {!nextPaycheckDate && !daysUntilBonus && (
                      <IonText color="medium">
                        <p>No upcoming income events detected</p>
                      </IonText>
                    )}
                  </div>
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