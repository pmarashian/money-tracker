'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonInput, IonSpinner, IonText, IonItem, IonLabel } from '@ionic/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, User } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface UserSettings {
  balance: number
  paycheckAmount: number
  nextBonusDate: string
  bonusAmount?: number
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UserSettings>({
    balance: 0,
    paycheckAmount: 0,
    nextBonusDate: '',
    bonusAmount: 0
  })
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUserAuth = async () => {
      const authenticatedUser = await checkAuth()
      setUser(authenticatedUser)
      setLoading(false)

      if (!authenticatedUser) {
        router.push('/login')
        return
      }

      // Load current settings
      await loadSettings()
    }

    checkUserAuth()
  }, [router])

  const loadSettings = async () => {
    try {
      // For now, we'll load from localStorage on client side
      // In a real app, this would be a GET /api/settings endpoint
      if (typeof window !== 'undefined') {
        const savedSettings = localStorage.getItem('userSettings')
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings))
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSaveStatus(null)

    try {
      // Validate inputs
      if (settings.paycheckAmount <= 0) {
        setError('Paycheck amount must be greater than 0')
        return
      }

      if (!settings.nextBonusDate) {
        setError('Next bonus date is required')
        return
      }

      const bonusDate = new Date(settings.nextBonusDate)
      if (isNaN(bonusDate.getTime())) {
        setError('Invalid bonus date format')
        return
      }

      if (bonusDate <= new Date()) {
        setError('Bonus date must be in the future')
        return
      }

      // Save to API
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        // Also save to localStorage as backup
        if (typeof window !== 'undefined') {
          localStorage.setItem('userSettings', JSON.stringify(settings))
        }
        setSaveStatus('Settings saved successfully!')

        setTimeout(() => {
          setSaveStatus(null)
        }, 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Save error:', error)
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (field: keyof UserSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="circular" />
          <p>Loading...</p>
        </IonContent>
      </IonPage>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto space-y-4">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="font-heading text-sm">Financial Settings</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="space-y-4">
                <IonItem>
                  <IonLabel position="stacked" className="font-body text-xs">
                    Current Balance ($)
                  </IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    value={settings.balance}
                    onIonChange={(e) => updateSetting('balance', parseFloat(e.detail.value || '0') || 0)}
                    placeholder="0.00"
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked" className="font-body text-xs">
                    Paycheck Amount ($)
                  </IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    value={settings.paycheckAmount}
                    onIonChange={(e) => updateSetting('paycheckAmount', parseFloat(e.detail.value || '0') || 0)}
                    placeholder="2000.00"
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked" className="font-body text-xs">
                    Next Bonus Date
                  </IonLabel>
                  <IonInput
                    type="date"
                    value={settings.nextBonusDate}
                    onIonChange={(e) => updateSetting('nextBonusDate', e.detail.value || '')}
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked" className="font-body text-xs">
                    Bonus Amount ($) (Optional)
                  </IonLabel>
                  <IonInput
                    type="number"
                    step="0.01"
                    value={settings.bonusAmount || ''}
                    onIonChange={(e) => updateSetting('bonusAmount', parseFloat(e.detail.value || '0') || 0)}
                    placeholder="3000.00"
                  />
                </IonItem>

                <div className="pt-2">
                  <IonButton
                    expand="block"
                    onClick={saveSettings}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <IonSpinner slot="start" name="circular" />
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </IonButton>
                </div>

                {error && (
                  <div className="bg-red-900 border border-red-700 rounded-lg p-3 mt-3">
                    <IonText color="danger">
                      <p className="font-body text-xs">{error}</p>
                    </IonText>
                  </div>
                )}

                {saveStatus && (
                  <div className="bg-green-900 border border-green-700 rounded-lg p-3 mt-3">
                    <IonText color="success">
                      <p className="font-body text-xs">{saveStatus}</p>
                    </IonText>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardContent>
              <p className="font-body text-xs text-gray-500 text-center">
                These settings are used to calculate your financial health and projected balance.
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}