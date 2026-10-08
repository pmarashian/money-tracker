import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonToast,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAppBackground } from '../hooks/useAppBackground';
import { BackgroundPickerCarousel } from '../components/BackgroundPickerCarousel';
import { RrWin } from '../components/rr/RrWin';
import { RrField } from '../components/rr/RrField';
import { RrCmdButton } from '../components/rr/RrCmdButton';
import type { BackgroundId } from '../lib/appBackgrounds';
import { RetroLoaderPage } from '../components/RetroLoaderPage';
import { useRetroPageLoading } from '../hooks/useRetroPageLoading';

interface UserSettings {
  paycheckAmount: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  paycheckAmount: 2000,
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout, changePassword } = useAuth();
  const { backgroundId, setBackgroundId } = useAppBackground();

  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const showToast = (message: string, color: 'success' | 'danger') => {
    setToastMessage(message);
    setToastColor(color);
    setToastOpen(true);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const result = await apiGet<{ paycheckAmount?: number }>('/api/settings');
    if (result.ok && result.data) {
      const paycheckAmount =
        typeof result.data.paycheckAmount === 'number' && !Number.isNaN(result.data.paycheckAmount)
          ? result.data.paycheckAmount
          : DEFAULT_SETTINGS.paycheckAmount;
      setSettings({ paycheckAmount });
    } else if (!result.ok) {
      showToast(result.error || 'Failed to load settings', 'danger');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const paycheckNum = Number(settings.paycheckAmount);
    const result = await apiPatch('/api/settings', {
      paycheckAmount: !Number.isNaN(paycheckNum) ? paycheckNum : 2000,
    });
    if (result.ok) {
      showToast('Paycheck amount saved', 'success');
    } else {
      showToast(result.error || 'Failed to save settings', 'danger');
    }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordChanging(true);
    const result = await changePassword(newPassword);
    if (result.success) {
      showToast('Password changed successfully', 'success');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } else {
      setPasswordError(result.error || 'Failed to change password');
      showToast(result.error || 'Failed to change password', 'danger');
    }
    setPasswordChanging(false);
  };

  const { showLoader, blocking: loadingBlocking } = useRetroPageLoading(loading);

  if (loadingBlocking) {
    return (
      <RetroLoaderPage
        title="Settings"
        label="LOADING SETTINGS"
        showLoader={showLoader}
      />
    );
  }

  return (
    <IonPage className="rr-app">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="rr-stack">
          <p className="rr-lead">
            Control panel for projection inputs. Balances come from snapshot pushes.
          </p>

          <RrWin tag="BACKGROUND">
            <p className="rr-label" style={{ marginBottom: 8 }}>
              Pixel art behind tabs. Scenery anchors to the bottom.
            </p>
            <BackgroundPickerCarousel
              backgroundId={backgroundId}
              onSelect={(id: BackgroundId) => setBackgroundId(id)}
            />
          </RrWin>

          <RrWin tag="INCOME">
            <RrField
              label="Paycheck amount ($)"
              inputProps={{
                id: 'paycheck-amount',
                type: 'number',
                inputMode: 'decimal',
                value: String(settings.paycheckAmount),
                placeholder: '2000.00',
                step: '0.01',
                min: 0,
                onChange: (e) =>
                  setSettings({
                    paycheckAmount: parseFloat(e.target.value || '0') || 0,
                  }),
              }}
            />
            <RrCmdButton onClick={saveSettings} disabled={saving} showCursor={!saving}>
              {saving ? 'Saving...' : 'Save paycheck'}
            </RrCmdButton>
          </RrWin>

          <RrWin tag="ACCOUNT">
            <RrField
              label="New password"
              inputProps={{
                id: 'new-password',
                type: 'password',
                value: newPassword,
                placeholder: 'Enter new password',
                disabled: passwordChanging,
                onChange: (e) => setNewPassword(e.target.value),
              }}
            />
            <RrField
              label="Confirm password"
              inputProps={{
                id: 'confirm-password',
                type: 'password',
                value: confirmPassword,
                placeholder: 'Confirm new password',
                disabled: passwordChanging,
                onChange: (e) => setConfirmPassword(e.target.value),
              }}
            />
            {passwordError && <p className="rr-danger rr-fs-m">{passwordError}</p>}
            <RrCmdButton
              onClick={handlePasswordChange}
              disabled={
                passwordChanging ||
                !newPassword ||
                !confirmPassword ||
                newPassword.length < 6 ||
                newPassword !== confirmPassword
              }
            >
              {passwordChanging ? 'Changing...' : 'Change password'}
            </RrCmdButton>
            <RrCmdButton
              variant="danger"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Logout
            </RrCmdButton>
          </RrWin>
        </div>

        <IonToast
          isOpen={toastOpen}
          onDidDismiss={() => setToastOpen(false)}
          message={toastMessage}
          color={toastColor}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Settings;
