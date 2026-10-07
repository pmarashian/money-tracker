import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAppBackground } from '../hooks/useAppBackground';
import { BackgroundPickerCarousel } from '../components/BackgroundPickerCarousel';
import { NesField } from '../components/nes/NesField';
import { NesPanel } from '../components/nes/NesPanel';
import type { BackgroundId } from '../lib/appBackgrounds';

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

  if (loading) {
    return (
      <IonPage className="nes-screen">
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="crescent" />
          <p className="nes-lead">Loading settings...</p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage className="nes-screen">
      <IonHeader className="nes-screen__header">
        <IonToolbar className="nes-toolbar">
          <IonTitle className="nes-toolbar__title">Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <p className="nes-lead">
            Control panel for projection inputs. Balances come from snapshot pushes.
          </p>

          <NesPanel title="Background">
            <p className="nes-lead" style={{ marginBottom: 0 }}>
              Pixel art behind tabs. Scenery anchors to the bottom.
            </p>
            <BackgroundPickerCarousel
              backgroundId={backgroundId}
              onSelect={(id: BackgroundId) => setBackgroundId(id)}
            />
          </NesPanel>

          <NesPanel title="Income">
            <NesField
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
            <IonButton
              expand="block"
              className="btn-retro btn-retro--primary"
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save paycheck'}
            </IonButton>
          </NesPanel>

          <NesPanel title="Account">
            <NesField
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
            <NesField
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
            {passwordError && <p className="nes-error">{passwordError}</p>}
            <IonButton
              expand="block"
              className="btn-retro btn-retro--primary"
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
            </IonButton>
            <IonButton
              expand="block"
              className="btn-retro btn-retro--danger"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Logout
            </IonButton>
          </NesPanel>
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
