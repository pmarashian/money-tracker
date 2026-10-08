import React, { useState, useEffect } from 'react';
import { IonAlert } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthMenuLink } from '../components/auth/AuthMenuLink';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrCmdButton } from '../components/rr/RrCmdButton';
import { RetroLoader } from '../components/RetroLoader';
import { useRetroPageLoading } from '../hooks/useRetroPageLoading';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();
  const { login, user, loading: authLoading } = useAuth();
  const { showLoader: showAuthLoader, blocking: authBlocking } =
    useRetroPageLoading(authLoading);
  const { showLoader: showSubmitLoader, blocking: submitBlocking } =
    useRetroPageLoading(loading);

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

  if (authBlocking) {
    return (
      <div className="rr-loader-screen rr-app">
        {showAuthLoader ? <RetroLoader label="LOADING" /> : null}
      </div>
    );
  }

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
          <div className="auth-screen__cmd-menu" role="group" aria-label="Sign in commands">
            <RrCmdButton type="submit" disabled={loading} showCursor={!loading}>
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </RrCmdButton>
            <AuthMenuLink to="/forgot-password">Forgot password</AuthMenuLink>
            <AuthMenuLink to="/reset-password">Have a reset code</AuthMenuLink>
          </div>
        </RrWin>
      </form>

      {submitBlocking && showSubmitLoader ? (
        <div className="rr-loader-screen rr-loader-screen--overlay" aria-hidden>
          <RetroLoader label="SIGNING IN" />
        </div>
      ) : null}

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
