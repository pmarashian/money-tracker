import React, { useEffect, useState } from 'react'
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
  IonBadge
} from '@ionic/react'
import { useHistory } from 'react-router-dom'

const ExpensesPage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const history = useHistory()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/session', {
        credentials: 'include',
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        // Not logged in, redirect to login
        history.push('/login')
      }
    } catch (err) {
      // Network error, redirect to login
      history.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <IonText>Loading...</IonText>
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
              <IonCardTitle>Track Your Expenses</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText className="font-body">
                <p>Manage and track your expenses here.</p>
                <p>Features coming soon:</p>
                <ul>
                  <li>View expense history</li>
                  <li>Add new expenses</li>
                  <li>Expense categories</li>
                  <li>Expense reports</li>
                </ul>
              </IonText>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Recent Expenses</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonLabel>
                    <h2>Groceries</h2>
                    <p>Whole Foods Market</p>
                  </IonLabel>
                  <IonBadge color="danger" slot="end">-$85.32</IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h2>Gas</h2>
                    <p>Shell Station</p>
                  </IonLabel>
                  <IonBadge color="danger" slot="end">-$45.00</IonBadge>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <h2>Coffee</h2>
                    <p>Starbucks</p>
                  </IonLabel>
                  <IonBadge color="danger" slot="end">-$5.25</IonBadge>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default ExpensesPage