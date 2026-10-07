import React, { useState, useEffect } from 'react';
import { IonAlert } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthNavLink } from '../components/auth/AuthNavLink';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrCmdButton } from '../components/rr/RrCmdButton';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();
  const { login, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/app/home', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/app/home');
    } else {
      setError(result.error || 'Login failed');
      setShowAlert(true);
    }
    setLoading(false);
  };

  return (
    <AuthScreenShell subtitle="SIGN IN">
      <form className="auth-screen__form" onSubmit={handleLogin}>
        <RrWin tag="LOGIN">
          <RrField
            label="Email"
            inputProps={{
              id: 'login-email',
              type: 'email',
              name: 'email',
              autoComplete: 'email',
              inputMode: 'email',
              value: email,
              placeholder: 'you@mail.com',
              required: true,
              onChange: (e) => setEmail(e.target.value),
            }}
          />
          <RrField
            label="Password"
            inputProps={{
              id: 'login-password',
              type: 'password',
              name: 'password',
              autoComplete: 'current-password',
              value: password,
              placeholder: '********',
              required: true,
              onChange: (e) => setPassword(e.target.value),
            }}
          />
        </RrWin>

        <RrWin tag="COMMAND" className="auth-screen__cmd-win">
          <RrCmdButton type="submit" disabled={loading} showCursor={!loading}>
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </RrCmdButton>
        </RrWin>
      </form>

      <nav className="auth-screen__nav" aria-label="Other sign-in options">
        <AuthNavLink to="/forgot-password">Forgot password</AuthNavLink>
        <AuthNavLink to="/reset-password">Have a reset code</AuthNavLink>
      </nav>

      <IonAlert
        cssClass="rr-alert"
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Login failed"
        message={error}
        buttons={['OK']}
      />
    </AuthScreenShell>
  );
};

export default Login;
