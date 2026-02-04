import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonRouterLink,
  IonLoading,
  IonAlert,
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session management
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - redirect to home
        navigate('/app/home');
      } else {
        // Error - show error message
        setError(data.message || 'Login failed');
        setShowAlert(true);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setShowAlert(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="ion-text-center ion-margin-bottom">
          <h2 className="font-heading">Welcome Back</h2>
          <p className="font-body">Sign in to your Money Tracker account</p>
        </div>

        <form onSubmit={handleLogin}>
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

          <IonButton
            expand="block"
            type="submit"
            className="ion-margin-top"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </IonButton>
        </form>

        <div className="ion-text-center ion-margin-top">
          <IonText color="medium">
            Don't have an account?{' '}
            <IonRouterLink routerLink="/register">Sign Up</IonRouterLink>
          </IonText>
        </div>

        <IonLoading isOpen={loading} message="Signing in..." />
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Login Failed"
          message={error}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;