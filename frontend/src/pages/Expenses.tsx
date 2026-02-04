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
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';

interface RecurringPattern {
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly';
  typicalDayOfMonth?: number;
}

const Expenses: React.FC = () => {
  const { user } = useAuth();
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecurringExpenses = async () => {
      if (!user) return;

      try {
        const response = await apiGet('/api/transactions/recurring');

        if (!response.ok) {
          throw new Error('Failed to fetch recurring expenses');
        }

        const data = await response.json();
        setRecurringExpenses(data.recurring || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRecurringExpenses();
  }, [user]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount)); // Use absolute value since amounts are negative
  };

  const formatFrequency = (frequency: string): string => {
    switch (frequency) {
      case 'monthly':
        return 'Monthly';
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Bi-weekly';
      default:
        return frequency;
    }
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen className="ion-text-center">
          <div className="ion-padding">
            <IonSpinner name="crescent" />
            <p className="font-body">Loading recurring expenses...</p>
          </div>
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
            <IonTitle>Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <div className="ion-padding">
            <IonText color="danger">
              <h2>Error loading expenses</h2>
              <p>{error}</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Recurring Expenses</h1>
          <p className="font-body">Your automatically detected recurring expenses.</p>

          {recurringExpenses.length === 0 ? (
            <div className="ion-text-center ion-padding">
              <IonText color="medium">
                <h3>No recurring expenses found</h3>
                <p>Upload your CSV transactions to detect recurring patterns.</p>
              </IonText>
            </div>
          ) : (
            <div>
              {recurringExpenses.map((expense, index) => (
                <IonCard key={index} className="ion-margin-bottom">
                  <IonCardHeader>
                    <IonCardTitle className="font-heading">{expense.name}</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div className="ion-text-start">
                      <p className="font-body">
                        <strong>Amount:</strong> {formatCurrency(expense.amount)}
                      </p>
                      <p className="font-body">
                        <strong>Frequency:</strong> {formatFrequency(expense.frequency)}
                      </p>
                      {expense.typicalDayOfMonth && (
                        <p className="font-body">
                          <strong>Day of month:</strong> {expense.typicalDayOfMonth}
                        </p>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Expenses;