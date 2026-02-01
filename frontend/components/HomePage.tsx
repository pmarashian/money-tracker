'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, logout, User } from '@/lib/auth'

export function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkUserAuth = async () => {
      const authenticatedUser = await checkAuth()
      setUser(authenticatedUser)
      setLoading(false)

      if (!authenticatedUser) {
        router.push('/login')
      }
    }

    checkUserAuth()
  }, [router])

  const handleLogout = async () => {
    await logout()
    setUser(null)
    router.push('/login')
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
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
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Welcome back, {user.email}!</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p className="text-gray-600 mb-4">
                You're successfully logged in to your Money Tracker account.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}
                </p>
              </div>

              <IonButton
                expand="block"
                color="danger"
                onClick={handleLogout}
              >
                Logout
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}