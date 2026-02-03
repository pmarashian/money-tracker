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
  IonButton,
  IonIcon,
  IonToggle
} from '@ionic/react'
import { person, notifications, moon, helpCircle, logOut } from 'ionicons/icons'
import { useHistory } from 'react-router-dom'

const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    emailUpdates: false,
  })
  const history = useHistory()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/session', {
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

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      // Redirect to login regardless of response
      history.push('/login')
    } catch (err) {
      // Still redirect to login even if logout fails
      history.push('/login')
    }
  }

  const updateSetting = (key: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
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
          <IonTitle className="font-heading">Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ padding: '20px' }}>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Account</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonIcon icon={person} slot="start" />
                  <IonLabel>
                    <h2>Email</h2>
                    <p>{user?.email}</p>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonIcon icon={logOut} slot="start" />
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={handleLogout}
                    color="danger"
                  >
                    Logout
                  </IonButton>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Preferences</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonIcon icon={notifications} slot="start" />
                  <IonLabel>Push Notifications</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={settings.notifications}
                    onIonChange={(e) => updateSetting('notifications', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={moon} slot="start" />
                  <IonLabel>Dark Mode</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={settings.darkMode}
                    onIonChange={(e) => updateSetting('darkMode', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={helpCircle} slot="start" />
                  <IonLabel>Email Updates</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={settings.emailUpdates}
                    onIonChange={(e) => updateSetting('emailUpdates', e.detail.checked)}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>About</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText className="font-body">
                <p><strong>Money Tracker</strong></p>
                <p>Version 1.0.0</p>
                <p>Track your expenses, manage your budget, and get AI-powered financial insights.</p>
                <p>Features:</p>
                <ul>
                  <li>Automatic expense categorization</li>
                  <li>Recurring expense detection</li>
                  <li>Financial health analysis</li>
                  <li>AI assistant for financial advice</li>
                </ul>
              </IonText>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default SettingsPage