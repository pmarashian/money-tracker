import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthNavLink } from '../components/auth/AuthNavLink';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrCmdButton } from '../components/rr/RrCmdButton';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const result = await apiPost<{ message?: string }>('/api/auth/forgot-password', { email });

    setLoading(false);
    if (result.ok) {
      setSuccess(true);
    }
  };

  return (
    <AuthScreenShell subtitle="FORGOT PASSWORD">
      {success ? (
        <>
          <RrWin tag="SENT">
            <p className="auth-screen__message">
              If an account exists with this email, you&apos;ll receive a reset link. Check your
              inbox.
            </p>
          </RrWin>
          <nav className="auth-screen__nav">
            <AuthNavLink to="/reset-password">Have a reset code</AuthNavLink>
            <AuthNavLink to="/login">Back to sign in</AuthNavLink>
          </nav>
        </>
      ) : (
        <>
          <form className="auth-screen__form" onSubmit={handleSubmit}>
            <RrWin tag="EMAIL">
              <RrField
                label="Email"
                inputProps={{
                  id: 'forgot-email',
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
            </RrWin>
            <RrWin tag="COMMAND" className="auth-screen__cmd-win">
              <RrCmdButton type="submit" disabled={loading} showCursor={!loading}>
                {loading ? 'SENDING...' : 'SEND RESET LINK'}
              </RrCmdButton>
            </RrWin>
          </form>
          <nav className="auth-screen__nav">
            <AuthNavLink to="/reset-password">Have a reset code</AuthNavLink>
            <AuthNavLink to="/login">Back to sign in</AuthNavLink>
          </nav>
        </>
      )}
    </AuthScreenShell>
  );
};

export default ForgotPassword;
