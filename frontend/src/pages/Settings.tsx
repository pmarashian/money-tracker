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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonText,
  IonToast,
} from '@ionic/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useAppBackground } from '../hooks/useAppBackground';
import { BACKGROUND_OPTIONS, type BackgroundId } from '../lib/appBackgrounds';

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
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="crescent" />
          <IonText color="medium">
            <p className="font-body">Loading settings...</p>
          </IonText>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ion-padding">
          <p className="font-body" style={{ marginBottom: '1.25rem' }}>
            Control panel for your projection inputs. Balances and forecasts come from your
            assistant&apos;s snapshot pushes.
          </p>

          <IonCard className="settings-section-card">
            <IonCardHeader>
              <IonCardTitle className="font-heading">Background</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p className="font-body" style={{ marginBottom: '0.5rem' }}>
                Full-page pixel art behind the app tabs. Scenery anchors to the bottom of the screen.
              </p>
              <div className="background-picker" role="listbox" aria-label="Background">
                {BACKGROUND_OPTIONS.map((option) => {
                  const selected = backgroundId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`background-picker__option${selected ? ' background-picker__option--selected' : ''}`}
                      onClick={() => setBackgroundId(option.id as BackgroundId)}
                    >
                      {option.src ? (
                        <div
                          className="background-picker__thumb"
                          style={{ backgroundImage: `url(${option.src})` }}
                        />
                      ) : (
                        <div className="background-picker__thumb background-picker__thumb--none">Black</div>
                      )}
                      <span className="background-picker__label font-body">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard className="settings-section-card">
            <IonCardHeader>
              <IonCardTitle className="font-heading">Income</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked" className="font-body">
                  Paycheck amount ($)
                </IonLabel>
                <IonInput
                  type="number"
                  inputMode="decimal"
                  value={settings.paycheckAmount}
                  placeholder="2000.00"
                  onIonInput={(e) =>
                    setSettings({
                      paycheckAmount: parseFloat((e.detail.value as string) || '0') || 0,
                    })
                  }
                  step="0.01"
                  min="0"
                />
              </IonItem>
              <IonButton
                expand="block"
                className="ion-margin-top"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save paycheck amount'}
              </IonButton>
            </IonCardContent>
          </IonCard>

          <IonCard className="settings-section-card settings-section-card--account">
            <IonCardHeader>
              <IonCardTitle className="font-heading">Account</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked" className="font-body">New password</IonLabel>
                <IonInput
                  type="password"
                  value={newPassword}
                  placeholder="Enter new password"
                  onIonInput={(e) => setNewPassword(e.detail.value ?? '')}
                  disabled={passwordChanging}
                />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked" className="font-body">Confirm password</IonLabel>
                <IonInput
                  type="password"
                  value={confirmPassword}
                  placeholder="Confirm new password"
                  onIonInput={(e) => setConfirmPassword(e.detail.value ?? '')}
                  disabled={passwordChanging}
                />
              </IonItem>
              {passwordError && (
                <IonText color="danger" className="font-body" style={{ display: 'block', marginTop: '0.5rem' }}>
                  {passwordError}
                </IonText>
              )}
              <IonButton
                expand="block"
                className="ion-margin-top"
                onClick={handlePasswordChange}
                disabled={
                  passwordChanging ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword.length < 6 ||
                  newPassword !== confirmPassword
                }
              >
                {passwordChanging ? 'Changing password...' : 'Change password'}
              </IonButton>
              <IonButton
                expand="block"
                color="danger"
                className="ion-margin-top"
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
              >
                Logout
              </IonButton>
            </IonCardContent>
          </IonCard>
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
