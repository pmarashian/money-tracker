import React, { useEffect } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonIcon
} from '@ionic/react'
import { useHistory } from 'react-router-dom'
import { useRecurringExpenses } from '../hooks/useRecurringExpenses'
import { repeat, calendar } from 'ionicons/icons'

const ExpensesPage: React.FC = () => {
  const history = useHistory()
  const { recurringExpenses, loading, error } = useRecurringExpenses()

  useEffect(() => {
    // Check if user is logged in via session check
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/session', {
        credentials: 'include',
      })

      if (!response.ok) {
        // Not logged in, redirect to login
        history.push('/login')
      }
    } catch (err) {
      // Network error, redirect to login
      history.push('/login')
    }
  }

  // Format amount as currency
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount))
  }

  // Format frequency as human-readable
  const formatFrequency = (frequency: string): string => {
    switch (frequency) {
      case 'weekly': return 'Weekly'
      case 'biweekly': return 'Bi-weekly'
      case 'monthly': return 'Monthly'
      case 'quarterly': return 'Quarterly'
      case 'yearly': return 'Yearly'
      default: return frequency
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle className="font-heading">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <IonSpinner name="crescent" />
            <IonText style={{ marginLeft: '10px' }}>Loading recurring expenses...</IonText>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle className="font-heading">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '20px' }}>
            <IonCard color="danger">
              <IonCardHeader>
                <IonCardTitle>Error Loading Expenses</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="danger">{error}</IonText>
              </IonCardContent>
            </IonCard>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ padding: '20px' }}>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Recurring Expenses</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {!recurringExpenses || recurringExpenses.length === 0 ? (
                <IonText className="font-body">
                  <p>No recurring expenses detected yet.</p>
                  <p>Upload some transaction data to see recurring patterns.</p>
                </IonText>
              ) : (
                <IonList>
                  {recurringExpenses.map((expense, index) => (
                    <IonItem key={index}>
                      <IonIcon icon={repeat} slot="start" color="primary" />
                      <IonLabel>
                        <h2>{expense.name}</h2>
                        <p>
                          <IonIcon icon={calendar} size="small" />
                          {' '}
                          {formatFrequency(expense.frequency)}
                          {expense.typicalDayOfMonth && expense.frequency === 'monthly'
                            ? ` (around day ${expense.typicalDayOfMonth})`
                            : ''
                          }
                        </p>
                        <p style={{ fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
                          {expense.transactionCount} transactions • Last: {expense.lastDate}
                        </p>
                      </IonLabel>
                      <IonBadge color="danger" slot="end">
                        -{formatAmount(expense.amount)}
                      </IonBadge>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default ExpensesPage