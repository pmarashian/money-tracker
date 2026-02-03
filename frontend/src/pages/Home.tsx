import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonBadge,
  IonIcon,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherEventDetail
} from '@ionic/react'
import { useHistory } from 'react-router-dom'
import { trendingUp, trendingDown, wallet, calendar, settings } from 'ionicons/icons'
import { useHealth } from '../hooks/useHealth'

const HomePage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const history = useHistory()
  const { healthData, loading: healthLoading, error: healthError, refetch } = useHealth()

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

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3002/api/auth/logout', {
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

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await refetch()
    event.detail.complete()
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'enough': return 'success'
      case 'not_enough': return 'danger'
      case 'too_much': return 'warning'
      default: return 'medium'
    }
  }

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'enough': return 'Good'
      case 'not_enough': return 'Low Balance'
      case 'too_much': return 'High Balance'
      default: return 'Unknown'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getNextPaycheckInfo = () => {
    if (!healthData?.breakdown.inflows) return null

    const paychecks = healthData.breakdown.inflows.filter(inflow => inflow.type === 'payroll')
    if (paychecks.length === 0) return null

    const nextPaycheck = paychecks[0] // They're sorted by date
    const paycheckDate = new Date(nextPaycheck.date)
    const today = new Date()
    const daysUntil = Math.ceil((paycheckDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    return {
      date: nextPaycheck.date,
      amount: nextPaycheck.amount,
      daysUntil: daysUntil > 0 ? daysUntil : 0
    }
  }

  const getNextBonusInfo = () => {
    if (!healthData?.breakdown.inflows) return null

    const bonuses = healthData.breakdown.inflows.filter(inflow => inflow.type === 'bonus')
    if (bonuses.length === 0) return null

    const nextBonus = bonuses[0] // They're sorted by date
    const bonusDate = new Date(nextBonus.date)
    const today = new Date()
    const daysUntil = Math.ceil((bonusDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    return {
      date: nextBonus.date,
      amount: nextBonus.amount,
      daysUntil: daysUntil > 0 ? daysUntil : 0
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
          <IonTitle className="font-heading">Money Tracker</IonTitle>
          <IonButton slot="end" onClick={handleLogout}>
            Logout
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '20px' }}>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Welcome, {user?.email}!</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText className="font-body">
                <p>You are successfully logged in to Money Tracker.</p>
                <p>This is the home page where you'll manage your finances.</p>
              </IonText>
            </IonCardContent>
          </IonCard>

          {/* Financial Health Card */}
          <IonCard>
            <IonCardHeader>
              <IonCardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={wallet} />
                Financial Health
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {healthLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                  <IonSpinner name="crescent" />
                  <IonText style={{ marginLeft: '10px' }}>Loading health data...</IonText>
                </div>
              ) : healthError ? (
                <div>
                  <IonText color="danger">
                    <p><strong>Unable to load financial health data</strong></p>
                    <p>{healthError}</p>
                    {healthError.includes('log in') && (
                      <IonButton fill="clear" size="small" onClick={() => history.push('/login')}>
                        Go to Login
                      </IonButton>
                    )}
                    {healthError.includes('settings') && (
                      <IonButton fill="clear" size="small" onClick={() => history.push('/tabs/settings')}>
                        <IonIcon icon={settings} slot="start" />
                        Update Settings
                      </IonButton>
                    )}
                  </IonText>
                </div>
              ) : healthData ? (
                <div>
                  {/* Health Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <IonText>
                      <h3 style={{ margin: 0 }}>Status</h3>
                    </IonText>
                    <IonBadge color={getHealthStatusColor(healthData.status)}>
                      {getHealthStatusText(healthData.status)}
                    </IonBadge>
                  </div>

                  {/* Projected Balance */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    <IonIcon
                      icon={healthData.projectedBalance >= 0 ? trendingUp : trendingDown}
                      style={{ marginRight: '8px', color: healthData.projectedBalance >= 0 ? 'green' : 'red' }}
                    />
                    <div>
                      <IonText>
                        <h3 style={{ margin: 0 }}>Projected Balance</h3>
                        <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold' }}>
                          {formatCurrency(healthData.projectedBalance)}
                        </p>
                      </IonText>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div style={{ borderTop: '1px solid var(--ion-color-light-shade)', paddingTop: '16px' }}>
                    <IonText>
                      <h4 style={{ margin: '0 0 8px 0' }}>Summary</h4>
                    </IonText>

                    {(() => {
                      const paycheckInfo = getNextPaycheckInfo()
                      const bonusInfo = getNextBonusInfo()

                      return (
                        <div>
                          {paycheckInfo && (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                              <IonIcon icon={calendar} style={{ marginRight: '8px', color: 'var(--ion-color-primary)' }} />
                              <IonText>
                                <p style={{ margin: 0 }}>
                                  Next paycheck: {formatCurrency(paycheckInfo.amount)} on {paycheckInfo.date}
                                  {paycheckInfo.daysUntil > 0 && ` (${paycheckInfo.daysUntil} days)`}
                                </p>
                              </IonText>
                            </div>
                          )}

                          {bonusInfo && (
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                              <IonIcon icon={trendingUp} style={{ marginRight: '8px', color: 'var(--ion-color-success)' }} />
                              <IonText>
                                <p style={{ margin: 0 }}>
                                  Next bonus: {formatCurrency(bonusInfo.amount)} on {bonusInfo.date}
                                  {bonusInfo.daysUntil > 0 && ` (${bonusInfo.daysUntil} days)`}
                                </p>
                              </IonText>
                            </div>
                          )}

                          {!paycheckInfo && !bonusInfo && (
                            <IonText color="medium">
                              <p style={{ margin: 0, fontStyle: 'italic' }}>
                                No upcoming income events detected. Update your settings to see projections.
                              </p>
                              <IonButton fill="clear" size="small" onClick={() => history.push('/tabs/settings')}>
                                <IonIcon icon={settings} slot="start" />
                                Update Settings
                              </IonButton>
                            </IonText>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              ) : (
                <IonText color="medium">
                  <p>No health data available. Please check your settings.</p>
                  <IonButton fill="clear" size="small" onClick={() => history.push('/tabs/settings')}>
                    <IonIcon icon={settings} slot="start" />
                    Go to Settings
                  </IonButton>
                </IonText>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default HomePage