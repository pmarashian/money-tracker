'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonInput, IonLabel, IonItem, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonRouterLink } from '@ionic/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Success - redirect to home
        router.push('/')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Welcome Back</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <form onSubmit={handleSubmit}>
                <IonItem>
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput
                    type="email"
                    value={email}
                    onIonChange={(e) => setEmail(e.detail.value!)}
                    required
                    placeholder="Enter your email"
                  />
                </IonItem>

                <IonItem>
                  <IonLabel position="stacked">Password</IonLabel>
                  <IonInput
                    type="password"
                    value={password}
                    onIonChange={(e) => setPassword(e.detail.value!)}
                    required
                    placeholder="Enter your password"
                  />
                </IonItem>

                {error && (
                  <div className="text-red-600 text-sm mt-2 mb-2">
                    {error}
                  </div>
                )}

                <IonButton
                  expand="block"
                  type="submit"
                  disabled={loading}
                  className="mt-4"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </IonButton>
              </form>

              <div className="text-center mt-4">
                <IonRouterLink routerLink="/register">
                  Don't have an account? Register
                </IonRouterLink>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}