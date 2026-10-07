import React, { useState } from 'react';
import { IonAlert } from '@ionic/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthNavLink } from '../components/auth/AuthNavLink';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrCmdButton } from '../components/rr/RrCmdButton';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const showCodeForm = !token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setShowAlert(true);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setShowAlert(true);
      return;
    }

    setLoading(true);

    const body = token ? { token, newPassword } : { email, code, newPassword };

    const result = await apiPost<{ success?: boolean; message?: string }>(
      '/api/auth/reset-password',
      body
    );

    setLoading(false);

    if (result.ok && result.data?.success) {
      navigate('/login', { replace: true });
    } else {
      setError(
        result.error ??
          (token ? 'Invalid or expired reset link.' : 'Invalid or expired reset code.')
      );
      setShowAlert(true);
    }
  };

  return (
    <AuthScreenShell subtitle="RESET PASSWORD">
      <RrWin tag="HELP">
        <p className="auth-screen__message">
          {showCodeForm
            ? 'Enter the code from your email and the address you used to request the reset.'
            : 'You opened a reset link. Enter your new password below.'}
        </p>
      </RrWin>

      {showCodeForm && (
        <p className="auth-screen__hint rr-fs-m rr-dim">
          If you have a reset link, open it to skip the code.
        </p>
      )}

      {!showCodeForm && (
        <nav className="auth-screen__nav auth-screen__nav--compact">
          <AuthNavLink to="/reset-password" replace>Use code instead</AuthNavLink>
        </nav>
      )}

      <form className="auth-screen__form" onSubmit={handleSubmit}>
        <RrWin tag={showCodeForm ? 'CODE' : 'NEW PASS'}>
          {showCodeForm && (
            <>
              <RrField
                label="Email"
                inputProps={{
                  id: 'reset-email',
                  type: 'email',
                  name: 'email',
                  autoComplete: 'email',
                  value: email,
                  placeholder: 'you@mail.com',
                  required: true,
                  onChange: (e) => setEmail(e.target.value),
                }}
              />
              <RrField
                label="Reset code"
                inputProps={{
                  id: 'reset-code',
                  type: 'text',
                  inputMode: 'numeric',
                  maxLength: 6,
                  value: code,
                  placeholder: '123456',
                  required: true,
                  onChange: (e) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6)),
                }}
              />
            </>
          )}
          <RrField
            label="New password"
            inputProps={{
              id: 'reset-new-password',
              type: 'password',
              name: 'new-password',
              autoComplete: 'new-password',
              value: newPassword,
              placeholder: '********',
              required: true,
              onChange: (e) => setNewPassword(e.target.value),
            }}
          />
          <RrField
            label="Confirm password"
            inputProps={{
              id: 'reset-confirm-password',
              type: 'password',
              name: 'confirm-password',
              autoComplete: 'new-password',
              value: confirmPassword,
              placeholder: '********',
              required: true,
              onChange: (e) => setConfirmPassword(e.target.value),
            }}
          />
        </RrWin>

        <RrWin tag="COMMAND" className="auth-screen__cmd-win">
          <RrCmdButton type="submit" disabled={loading} showCursor={!loading}>
            {loading ? 'RESETTING...' : 'RESET PASSWORD'}
          </RrCmdButton>
        </RrWin>
      </form>

      <nav className="auth-screen__nav">
        {showCodeForm && <AuthNavLink to="/forgot-password">Request new code</AuthNavLink>}
        <AuthNavLink to="/login">Back to sign in</AuthNavLink>
      </nav>

      <IonAlert
        cssClass="rr-alert"
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Reset failed"
        message={error}
        buttons={['OK']}
      />
    </AuthScreenShell>
  );
};

export default ResetPassword;
