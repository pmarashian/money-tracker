import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonButton,
  IonLabel,
  IonSpinner,
  IonAlert,
  IonText,
} from '@ionic/react';

const Upload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success?: boolean;
    message?: string;
    rowCount?: number;
    recurringPatternsDetected?: number;
    payrollEventsDetected?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a CSV file');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:3000/api/transactions/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (response.ok) {
        setUploadResult({
          success: true,
          message: result.message,
          rowCount: result.rowCount,
          recurringPatternsDetected: result.recurringPatternsDetected,
          payrollEventsDetected: result.payrollEventsDetected,
        });
        setSelectedFile(null);
        // Clear file input
        const fileInput = document.getElementById('csvFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Upload</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Upload</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Upload</h1>
          <p className="font-body">Upload your Chase CSV file to analyze your financial data.</p>

          <IonCard>
            <IonCardContent>
              <IonLabel position="stacked">Select Chase CSV File</IonLabel>
              <input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--ion-color-medium)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--ion-background-color)',
                  color: 'var(--ion-text-color)',
                }}
              />

              {selectedFile && (
                <IonText color="medium">
                  <p>Selected: {selectedFile.name}</p>
                </IonText>
              )}

              <IonButton
                expand="block"
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                style={{ marginTop: '16px' }}
              >
                {isUploading ? (
                  <>
                    <IonSpinner slot="start" />
                    Uploading...
                  </>
                ) : (
                  'Upload CSV'
                )}
              </IonButton>
            </IonCardContent>
          </IonCard>

          {uploadResult?.success && (
            <IonCard color="success">
              <IonCardContent>
                <h3>Upload Successful!</h3>
                <p>{uploadResult.message}</p>
                {uploadResult.rowCount && (
                  <p><strong>Transactions processed:</strong> {uploadResult.rowCount}</p>
                )}
                {uploadResult.recurringPatternsDetected !== undefined && (
                  <p><strong>Recurring patterns detected:</strong> {uploadResult.recurringPatternsDetected}</p>
                )}
                {uploadResult.payrollEventsDetected !== undefined && (
                  <p><strong>Payroll events detected:</strong> {uploadResult.payrollEventsDetected}</p>
                )}
                <p>You can now view your recurring expenses and financial health.</p>
              </IonCardContent>
            </IonCard>
          )}

          <IonAlert
            isOpen={!!error}
            onDidDismiss={() => setError(null)}
            header="Upload Error"
            message={error || ''}
            buttons={['OK']}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Upload;