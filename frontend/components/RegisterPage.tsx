'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonInput, IonLabel, IonItem, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonRouterLink } from '@ionic/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RegisterPage() {
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
      const response = await fetch('/api/auth/register', {
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
        setError(data.message || 'Registration failed')
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
          <IonTitle>Register</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Create Account</IonCardTitle>
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
                    minlength={6}
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
                  {loading ? 'Creating account...' : 'Register'}
                </IonButton>
              </form>

              <div className="text-center mt-4">
                <IonRouterLink routerLink="/login">
                  Already have an account? Login
                </IonRouterLink>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}