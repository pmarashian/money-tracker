import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonLoading,
  IonAlert,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from '@ionic/react';
import { useState, useEffect } from 'react';

interface UserSettings {
  balance: number;
  paycheckAmount: number;
  nextBonusDate: string;
  bonusAmount?: number;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    balance: 0,
    paycheckAmount: 2000,
    nextBonusDate: '',
    bonusAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('success');

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Convert date to YYYY-MM-DD format for HTML date input
        const formattedDate = data.nextBonusDate ? data.nextBonusDate.split('T')[0] : '';
        setSettings({
          ...data,
          nextBonusDate: formattedDate,
        });
      } else {
        console.error('Failed to load settings');
        showAlertMessage('Failed to load settings', 'error');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      showAlertMessage('Error loading settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Validate required fields
      if (!settings.nextBonusDate) {
        showAlertMessage('Next bonus date is required', 'error');
        return;
      }

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showAlertMessage('Settings saved successfully!', 'success');
      } else {
        const errorData = await response.json();
        showAlertMessage(errorData.error || 'Failed to save settings', 'error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlertMessage('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showAlertMessage = (message: string, type: 'success' | 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
  };

  const handleInputChange = (field: keyof UserSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <IonLoading isOpen={loading} message="Loading settings..." />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="ion-padding">
          <h1 className="font-heading">Settings</h1>
          <p className="font-body">Configure your financial settings to improve health projections.</p>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="font-heading">Financial Settings</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem>
                <IonLabel position="stacked" className="font-body">
                  Current Balance ($)
                </IonLabel>
                <IonInput
                  type="number"
                  value={settings.balance}
                  placeholder="0.00"
                  onIonChange={(e) => handleInputChange('balance', parseFloat(e.detail.value || '0'))}
                  step="0.01"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked" className="font-body">
                  Paycheck Amount ($)
                </IonLabel>
                <IonInput
                  type="number"
                  value={settings.paycheckAmount}
                  placeholder="2000.00"
                  onIonChange={(e) => handleInputChange('paycheckAmount', parseFloat(e.detail.value || '0'))}
                  step="0.01"
                  min="0"
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked" className="font-body">
                  Next Bonus Date
                </IonLabel>
                <IonInput
                  type="date"
                  value={settings.nextBonusDate}
                  onIonChange={(e) => handleInputChange('nextBonusDate', e.detail.value || '')}
                />
              </IonItem>

              <IonItem>
                <IonLabel position="stacked" className="font-body">
                  Bonus Amount ($) (Optional)
                </IonLabel>
                <IonInput
                  type="number"
                  value={settings.bonusAmount || 0}
                  placeholder="0.00"
                  onIonChange={(e) => handleInputChange('bonusAmount', parseFloat(e.detail.value || '0'))}
                  step="0.01"
                  min="0"
                />
              </IonItem>

              <div style={{ marginTop: '20px' }}>
                <IonButton
                  expand="block"
                  onClick={saveSettings}
                  disabled={saving}
                  className="font-body"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertType === 'success' ? 'Success' : 'Error'}
          message={alertMessage}
          buttons={['OK']}
        />

        <IonLoading isOpen={saving} message="Saving settings..." />
      </IonContent>
    </IonPage>
  );
};

export default Settings;