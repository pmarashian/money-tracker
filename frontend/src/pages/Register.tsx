import React, { useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonAlert,
  IonLoading
} from '@ionic/react'
import { useHistory } from 'react-router-dom'

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showAlert, setShowAlert] = useState(false)
  const [loading, setLoading] = useState(false)

  const history = useHistory()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('http://localhost:3002/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Success - redirect to home
        history.push('/home')
      } else {
        // Error - show message
        setError(data.error || 'Registration failed')
        setShowAlert(true)
      }
    } catch (err) {
      setError('Network error. Please try again.')
      setShowAlert(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Register</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonChange={(e) => setEmail(e.detail.value!)}
              required
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Password</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonChange={(e) => setPassword(e.detail.value!)}
              required
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            style={{ marginTop: '20px' }}
            disabled={loading}
          >
            Register
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            routerLink="/login"
            style={{ marginTop: '10px' }}
          >
            Already have an account? Login
          </IonButton>
        </form>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Registration Error"
          message={error}
          buttons={['OK']}
        />

        <IonLoading
          isOpen={loading}
          message="Registering..."
        />
      </IonContent>
    </IonPage>
  )
}

export default RegisterPage