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

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setShowAlert(true);
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setShowAlert(true);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session management
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - redirect to login page
        navigate('/login');
      } else {
        // Error - show error message
        setError(data.message || 'Registration failed');
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
          <IonTitle>Register</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <div className="ion-text-center ion-margin-bottom">
          <h2 className="font-heading">Create Account</h2>
          <p className="font-body">Join Money Tracker to manage your expenses</p>
        </div>

        <form onSubmit={handleRegister}>
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
              placeholder="Create a password"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Confirm Password</IonLabel>
            <IonInput
              type="password"
              value={confirmPassword}
              onIonChange={(e) => setConfirmPassword(e.detail.value!)}
              required
              placeholder="Confirm your password"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            className="ion-margin-top"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </IonButton>
        </form>

        <div className="ion-text-center ion-margin-top">
          <IonText color="medium">
            Already have an account?{' '}
            <IonRouterLink routerLink="/login">Sign In</IonRouterLink>
          </IonText>
        </div>

        <IonLoading isOpen={loading} message="Creating account..." />
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Registration Failed"
          message={error}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default Register;