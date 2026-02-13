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
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiRequest } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string;
  bonusAmount?: number;
  nextPaycheckDate?: string;
  timezone?: string;
}

/** Curated IANA timezones for payday and projection calculations */
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Default' },
  { value: 'America/New_York', label: 'Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'Central (America/Chicago)' },
  { value: 'America/Denver', label: 'Mountain (America/Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Pacific/Honolulu)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
];

const DEFAULT_SETTINGS: UserSettings = {
  balance: 0,
  paycheckAmount: 2000,
  nextBonusDate: '',
  bonusAmount: 0,
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { logout, changePassword } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success?: boolean;
    message?: string;
    rowCount?: number;
    recurringPatternsDetected?: number;
    payrollEventsDetected?: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Password change state
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
    const result = await apiGet<UserSettings & { nextPaycheckDate?: string }>('/api/settings');
    if (result.ok && result.data) {
      const data = result.data;
      const formattedDate = data.nextBonusDate ? data.nextBonusDate.split('T')[0] : '';
      const nextPaycheckFormatted = data.nextPaycheckDate ? data.nextPaycheckDate.split('T')[0] : '';
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        nextBonusDate: formattedDate || DEFAULT_SETTINGS.nextBonusDate,
        nextPaycheckDate: nextPaycheckFormatted || undefined,
        balance: typeof data.balance === 'number' && !isNaN(data.balance) ? data.balance : DEFAULT_SETTINGS.balance,
        timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
      });
    } else if (!result.ok) {
      showToast(result.error || 'Failed to load settings', 'danger');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    if (!settings.nextBonusDate) {
      showToast('Next bonus date is required', 'danger');
      return;
    }

    setSaving(true);
    const paycheckNum = Number(settings.paycheckAmount);
    const payload: Record<string, unknown> = {
      balance: Number(settings.balance) || 0,
      paycheckAmount: !isNaN(paycheckNum) ? paycheckNum : 2000,
      nextBonusDate: settings.nextBonusDate,
    };
    if (settings.nextPaycheckDate) {
      payload.nextPaycheckDate = settings.nextPaycheckDate;
    }
    if (settings.timezone !== undefined) {
      payload.timezone = settings.timezone && settings.timezone.trim() ? settings.timezone.trim() : '';
    }
    const result = await apiPatch<UserSettings & { nextPaycheckDate?: string; timezone?: string }>('/api/settings', payload);
    if (result.ok && result.data) {
      const updated = result.data;
      const formattedDate = updated.nextBonusDate ? updated.nextBonusDate.split('T')[0] : '';
      const nextPaycheckFormatted = updated.nextPaycheckDate ? updated.nextPaycheckDate.split('T')[0] : '';
      setSettings({
        ...DEFAULT_SETTINGS,
        ...updated,
        nextBonusDate: formattedDate,
        nextPaycheckDate: nextPaycheckFormatted || undefined,
        timezone: typeof updated.timezone === 'string' ? updated.timezone : undefined,
      });
      showToast('Settings saved successfully', 'success');
    } else {
      showToast(result.error || 'Failed to save settings', 'danger');
    }
    setSaving(false);
  };

  const handleInputChange = (field: keyof UserSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setUploadError(null);
      setUploadResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please select a CSV file');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    setUploadResult(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const result = await apiRequest<{
      message?: string;
      rowCount?: number;
      recurringPatternsDetected?: number;
      payrollEventsDetected?: number;
    }>('/api/transactions/upload', {
      method: 'POST',
      body: formData,
    });

    if (result.ok && result.data) {
      const data = result.data;
      setUploadResult({
        success: true,
        message: data.message,
        rowCount: data.rowCount,
        recurringPatternsDetected: data.recurringPatternsDetected,
        payrollEventsDetected: data.payrollEventsDetected,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const parts = [
        data.rowCount != null && ` ${data.rowCount} transactions`,
        data.recurringPatternsDetected != null && ` ${data.recurringPatternsDetected} recurring`,
        data.payrollEventsDetected != null && ` ${data.payrollEventsDetected} payroll`,
      ].filter(Boolean);
      showToast(`Uploaded.${parts.length ? parts.join(',') : ''}`, 'success');
    } else {
      const errMsg = result.error || 'Upload failed';
      setUploadError(errMsg);
      showToast(errMsg, 'danger');
    }
    setIsUploading(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError('');

    // Validation
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
            Configure your financial settings to improve health projections.
          </p>

          {/* Data import */}
          <section className="settings-section" aria-labelledby="settings-data-import">
            <IonCard className="settings-section-card settings-section-card--data">
              <IonCardHeader className="settings-section-header">
                <IonCardTitle className="font-heading">Upload CSV</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p className="font-body" style={{ marginBottom: '0.75rem' }}>
                  Upload your Chase CSV file to analyze your financial data.
                </p>
                <label
                  className={`settings-upload-zone ${dragOver ? 'settings-upload-zone--dragover' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    ref={fileInputRef}
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    aria-label="Select Chase CSV file"
                  />
                  {selectedFile ? (
                    <span className="font-body">
                      {selectedFile.name}
                      <br />
                      <span style={{ fontSize: '0.9em', color: 'var(--ion-color-step-500)' }}>
                        Tap to change file
                      </span>
                    </span>
                  ) : (
                    <span>Drop CSV here or tap to browse</span>
                  )}
                </label>

                {selectedFile && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <IonButton
                      size="small"
                      fill="clear"
                      onClick={() => handleFileSelect(null)}
                      className="font-body"
                    >
                      Clear
                    </IonButton>
                    <IonButton
                      expand="block"
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="font-body"
                      style={{ flex: 1 }}
                    >
                      {isUploading ? (
                        <>
                          <IonSpinner slot="start" name="crescent" />
                          Uploading...
                        </>
                      ) : (
                        'Upload CSV'
                      )}
                    </IonButton>
                  </div>
                )}

                {uploadError && (
                  <p className="settings-upload-error font-body" role="alert">
                    {uploadError}
                  </p>
                )}

                {uploadResult?.success && (
                  <div className="settings-upload-result font-body">
                    {uploadResult.message}
                    {uploadResult.rowCount != null && ` · ${uploadResult.rowCount} transactions`}
                    {uploadResult.recurringPatternsDetected != null &&
                      ` · ${uploadResult.recurringPatternsDetected} recurring`}
                    {uploadResult.payrollEventsDetected != null &&
                      ` · ${uploadResult.payrollEventsDetected} payroll`}
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </section>

          {/* Financial settings */}
          <section className="settings-section" aria-labelledby="settings-financial">
            <IonCard className="settings-section-card settings-section-card--financial">
              <IonCardHeader className="settings-section-header">
                <IonCardTitle className="font-heading">Balance &amp; Income</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <span className="settings-form-group__label">Balance &amp; income</span>
                <div className="settings-form-group">
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      Your timezone (for payday and projections)
                    </IonLabel>
                    <IonSelect
                      value={settings.timezone ?? ''}
                      placeholder="Default"
                      onIonChange={(e) => handleInputChange('timezone', e.detail.value ?? '')}
                      interface="popover"
                      interfaceOptions={{ cssClass: 'timezone-select-popover' }}
                      className="font-body"
                    >
                      {TIMEZONE_OPTIONS.map((opt) => (
                        <IonSelectOption key={opt.value || 'default'} value={opt.value}>
                          {opt.label}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      Current balance ($)
                    </IonLabel>
                    <IonInput
                      type="number"
                      inputMode="decimal"
                      value={settings.balance}
                      placeholder="0.00"
                      onIonInput={(e) =>
                        handleInputChange('balance', parseFloat((e.detail.value as string) || '0') || 0)
                      }
                      step="0.01"
                    />
                  </IonItem>
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
                        handleInputChange('paycheckAmount', parseFloat((e.detail.value as string) || '0') || 0)
                      }
                      step="0.01"
                      min="0"
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      Next paycheck date (optional)
                    </IonLabel>
                    <IonInput
                      type="date"
                      value={settings.nextPaycheckDate || ''}
                      onIonChange={(e) => handleInputChange('nextPaycheckDate', e.detail.value || '')}
                    />
                  </IonItem>
                </div>

                <span className="settings-form-group__label">Bonus</span>
                <div className="settings-form-group">
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      Next bonus date
                    </IonLabel>
                    <IonInput
                      type="date"
                      value={settings.nextBonusDate}
                      onIonChange={(e) => handleInputChange('nextBonusDate', e.detail.value || '')}
                    />
                  </IonItem>
                </div>

                <div className="settings-primary-action">
                  <IonButton
                    expand="block"
                    size="default"
                    onClick={saveSettings}
                    disabled={saving}
                    className="font-body"
                  >
                    {saving ? 'Saving...' : 'Save settings'}
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          </section>

          {/* Account */}
          <section className="settings-section" aria-labelledby="settings-account">
            <IonCard className="settings-section-card settings-section-card--account">
              <IonCardHeader className="settings-section-header">
                <IonCardTitle className="font-heading">Account Settings</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <span className="settings-form-group__label">Change Password</span>
                <div className="settings-form-group">
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      New Password
                    </IonLabel>
                    <IonInput
                      type="password"
                      value={newPassword}
                      placeholder="Enter new password"
                      onIonInput={(e) => setNewPassword(e.detail.value ?? '')}
                      disabled={passwordChanging}
                    />
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked" className="font-body">
                      Confirm Password
                    </IonLabel>
                    <IonInput
                      type="password"
                      value={confirmPassword}
                      placeholder="Confirm new password"
                      onIonInput={(e) => setConfirmPassword(e.detail.value ?? '')}
                      disabled={passwordChanging}
                    />
                  </IonItem>
                  {passwordError && (
                    <IonText color="danger" className="font-body" style={{ display: 'block', marginTop: '0.5rem', paddingLeft: '1rem' }}>
                      {passwordError}
                    </IonText>
                  )}
                </div>
                <div className="settings-primary-action" style={{ marginTop: '1rem' }}>
                  <IonButton
                    expand="block"
                    size="default"
                    onClick={handlePasswordChange}
                    disabled={
                      passwordChanging ||
                      !newPassword ||
                      !confirmPassword ||
                      newPassword.length < 6 ||
                      newPassword !== confirmPassword
                    }
                    className="font-body"
                  >
                    {passwordChanging ? (
                      <>
                        <IonSpinner slot="start" name="crescent" />
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </IonButton>
                </div>
                <div className="settings-primary-action" style={{ marginTop: '1rem' }}>
                  <IonButton
                    expand="block"
                    size="default"
                    color="danger"
                    onClick={async () => {
                      await logout();
                      navigate('/login');
                    }}
                    className="font-body"
                  >
                    Logout
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          </section>
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
