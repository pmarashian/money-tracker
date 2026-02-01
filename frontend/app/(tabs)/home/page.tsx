'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonSpinner } from '@ionic/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, logout, User } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface HealthData {
  status: 'not_enough' | 'enough' | 'too_much'
  projectedBalance: number
  breakdown?: {
    inflows: number
    outflows: number
    daysUntilBonus: number
  }
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
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

      // Load health data
      await loadHealthData()
    }

    checkUserAuth()
  }, [router])

  const loadHealthData = async () => {
    setHealthLoading(true)
    try {
      const response = await fetch('/api/health', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setHealthData(data)
      }
    } catch (error) {
      console.error('Failed to load health data:', error)
    } finally {
      setHealthLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setUser(null)
    router.push('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_enough': return 'danger'
      case 'enough': return 'warning'
      case 'too_much': return 'success'
      default: return 'medium'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_enough': return 'Not Enough'
      case 'enough': return 'Enough'
      case 'too_much': return 'Too Much'
      default: return 'Unknown'
    }
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
          <IonTitle className="font-heading">Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto space-y-4">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="font-heading text-sm">Welcome back!</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p className="font-body text-xs text-gray-400 mb-2">
                {user.email}
              </p>
              <IonButton
                expand="block"
                color="danger"
                size="small"
                onClick={handleLogout}
              >
                Logout
              </IonButton>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="font-heading text-sm">Financial Health</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {healthLoading ? (
                <div className="ion-text-center">
                  <IonSpinner name="circular" />
                  <p className="font-body text-xs mt-2">Loading health data...</p>
                </div>
              ) : healthData ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-body ${
                      healthData.status === 'not_enough' ? 'bg-red-900 text-red-200' :
                      healthData.status === 'enough' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-green-900 text-green-200'
                    }`}>
                      {getStatusText(healthData.status)}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="font-body text-xs text-gray-400">Projected Balance</p>
                    <p className="font-heading text-lg">
                      ${healthData.projectedBalance.toFixed(2)}
                    </p>
                  </div>

                  {healthData.breakdown && (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-body text-gray-400">Inflows:</span>
                        <span className="font-body text-green-400">+${healthData.breakdown.inflows.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-gray-400">Outflows:</span>
                        <span className="font-body text-red-400">-${healthData.breakdown.outflows.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-body text-gray-400">Days until bonus:</span>
                        <span className="font-body">{healthData.breakdown.daysUntilBonus}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-body text-xs text-gray-400 mb-2">
                    No health data available
                  </p>
                  <p className="font-body text-xs text-gray-500">
                    Upload transactions and set your settings to see financial health.
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}