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
  IonToggle,
  IonInput,
  IonAlert,
  IonLoading,
  IonToast
} from '@ionic/react'
import { person, notifications, moon, helpCircle, logOut, save, wallet, cash, calendar, gift } from 'ionicons/icons'
import { useHistory } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'

const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [preferences, setPreferences] = useState({
    notifications: true,
    darkMode: true,
    emailUpdates: false,
  })

  // Financial settings form state
  const [formData, setFormData] = useState({
    balance: '',
    paycheckAmount: '',
    nextBonusDate: '',
    bonusAmount: '',
  })

  const history = useHistory()
  const { settings: financialSettings, loading: settingsLoading, error: settingsError, updateSettings } = useSettings()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  useEffect(() => {
    // Pre-fill form when financial settings load
    if (financialSettings) {
      setFormData({
        balance: financialSettings.balance.toString(),
        paycheckAmount: financialSettings.paycheckAmount.toString(),
        nextBonusDate: financialSettings.nextBonusDate,
        bonusAmount: financialSettings.bonusAmount?.toString() || '',
      })
    }
  }, [financialSettings])

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

  const updatePreference = (key: string, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    // Validate inputs
    const balance = parseFloat(formData.balance)
    const paycheckAmount = parseFloat(formData.paycheckAmount)
    const bonusAmount = formData.bonusAmount ? parseFloat(formData.bonusAmount) : undefined

    if (isNaN(balance)) {
      setAlertMessage('Please enter a valid balance')
      setShowAlert(true)
      return
    }

    if (isNaN(paycheckAmount) || paycheckAmount <= 0) {
      setAlertMessage('Please enter a valid paycheck amount')
      setShowAlert(true)
      return
    }

    if (bonusAmount !== undefined && (isNaN(bonusAmount) || bonusAmount < 0)) {
      setAlertMessage('Please enter a valid bonus amount')
      setShowAlert(true)
      return
    }

    // Validate date format if provided
    if (formData.nextBonusDate && formData.nextBonusDate.trim() !== '') {
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/
      if (!dateRegex.test(formData.nextBonusDate)) {
        setAlertMessage('Next bonus date must be in MM/DD/YYYY format')
        setShowAlert(true)
        return
      }
    }

    setSaving(true)

    const updates: any = {
      balance,
      paycheckAmount,
      nextBonusDate: formData.nextBonusDate,
    }

    if (bonusAmount !== undefined) {
      updates.bonusAmount = bonusAmount
    }

    const success = await updateSettings(updates)

    setSaving(false)

    if (success) {
      setShowSuccessToast(true)
    } else {
      setAlertMessage(settingsError || 'Failed to save settings')
      setShowAlert(true)
    }
  }

  if (loading || settingsLoading) {
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
              <IonCardTitle>Financial Settings</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem>
                  <IonIcon icon={wallet} slot="start" />
                  <IonLabel position="stacked">Current Balance ($)</IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.balance}
                    onIonChange={(e) => handleInputChange('balance', e.detail.value!)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={cash} slot="start" />
                  <IonLabel position="stacked">Paycheck Amount ($)</IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    placeholder="2000.00"
                    value={formData.paycheckAmount}
                    onIonChange={(e) => handleInputChange('paycheckAmount', e.detail.value!)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={calendar} slot="start" />
                  <IonLabel position="stacked">Next Bonus Date (MM/DD/YYYY)</IonLabel>
                  <IonInput
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={formData.nextBonusDate}
                    onIonChange={(e) => handleInputChange('nextBonusDate', e.detail.value!)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={gift} slot="start" />
                  <IonLabel position="stacked">Bonus Amount ($) - Optional</IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    placeholder="Leave empty if none"
                    value={formData.bonusAmount}
                    onIonChange={(e) => handleInputChange('bonusAmount', e.detail.value!)}
                  />
                </IonItem>
              </IonList>
              <IonButton
                expand="block"
                onClick={handleSave}
                disabled={saving}
                style={{ marginTop: '16px' }}
              >
                <IonIcon icon={save} slot="start" />
                {saving ? 'Saving...' : 'Save Settings'}
              </IonButton>
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
                    checked={preferences.notifications}
                    onIonChange={(e) => updatePreference('notifications', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={moon} slot="start" />
                  <IonLabel>Dark Mode</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={preferences.darkMode}
                    onIonChange={(e) => updatePreference('darkMode', e.detail.checked)}
                  />
                </IonItem>
                <IonItem>
                  <IonIcon icon={helpCircle} slot="start" />
                  <IonLabel>Email Updates</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={preferences.emailUpdates}
                    onIonChange={(e) => updatePreference('emailUpdates', e.detail.checked)}
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

      <IonLoading isOpen={saving} message="Saving settings..." />
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Error"
        message={alertMessage}
        buttons={['OK']}
      />
      <IonToast
        isOpen={showSuccessToast}
        onDidDismiss={() => setShowSuccessToast(false)}
        message="Settings saved successfully!"
        duration={2000}
        color="success"
      />
    </IonPage>
  )
}

export default SettingsPage