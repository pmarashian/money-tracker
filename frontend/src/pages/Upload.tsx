import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonText,
  IonButton,
  IonIcon,
  IonProgressBar
} from '@ionic/react'
import { cloudUpload } from 'ionicons/icons'
import { useHistory } from 'react-router-dom'
import { apiClient } from '../utils/api'

const UploadPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const history = useHistory()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await apiClient.get('/api/auth/session')

      if (response.error) {
        // Not logged in, redirect to login
        history.push('/login')
      }
    } catch (err) {
      // Network error, redirect to login
      history.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadResult(null)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // For file uploads, we need to make a direct fetch call since the API client expects JSON
      const response = await apiClient.makeRequest('/api/transactions/upload', {
        method: 'POST',
        body: formData,
        headers: {}, // Override default JSON content-type for FormData
      })

      if (!response.error) {
        setUploadResult(response.data)
        console.log('Upload successful:', response.data)
      } else {
        setError(typeof response.error === 'string' ? response.error : 'Upload failed')
        console.error('Upload failed:', response.error)
      }
    } catch (err) {
      setError('Network error occurred. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <IonText>Loading...</IonText>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Upload</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ padding: '20px' }}>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle>Upload Transaction Data</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText className="font-body">
                <p>Upload your bank statements to automatically track your expenses and income.</p>
                <p>Supported formats:</p>
                <ul>
                  <li>Chase CSV files</li>
                  <li>Automatic transaction categorization</li>
                  <li>Recurring expense detection</li>
                </ul>
              </IonText>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="file-upload"
                  disabled={uploading}
                />
                <label htmlFor="file-upload">
                  <IonButton
                    fill="outline"
                    size="large"
                    disabled={uploading}
                    style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
                  >
                    <IonIcon icon={cloudUpload} slot="start" />
                    {uploading ? 'Uploading...' : 'Select CSV File'}
                  </IonButton>
                </label>
              </div>

              {uploading && (
                <div style={{ marginTop: '20px' }}>
                  <IonProgressBar type="indeterminate" />
                  <IonText style={{ display: 'block', textAlign: 'center', marginTop: '10px' }}>
                    Processing your transactions...
                  </IonText>
                </div>
              )}

              {uploadResult && (
                <div style={{ marginTop: '20px' }}>
                  <IonCard color="success">
                    <IonCardContent>
                      <IonText color="success">
                        <h3>✅ Upload Successful!</h3>
                        <p>
                          Processed {uploadResult.transactionCount} transactions<br/>
                          Detected {uploadResult.recurringPatternsCount} recurring patterns<br/>
                          Found {uploadResult.payrollBonusEventsCount} payroll/bonus events
                        </p>
                        <div style={{ marginTop: '15px' }}>
                          <IonButton
                            fill="clear"
                            color="success"
                            onClick={() => history.push('/tabs/home')}
                            style={{ marginRight: '10px' }}
                          >
                            View Health Summary
                          </IonButton>
                          <IonButton
                            fill="clear"
                            color="success"
                            onClick={() => history.push('/tabs/expenses')}
                          >
                            View Recurring Expenses
                          </IonButton>
                        </div>
                      </IonText>
                    </IonCardContent>
                  </IonCard>
                </div>
              )}

              {error && (
                <div style={{ marginTop: '20px' }}>
                  <IonCard color="danger">
                    <IonCardContent>
                      <IonText color="danger">
                        <h3>❌ Upload Failed</h3>
                        <p>{error}</p>
                        <div style={{ marginTop: '10px' }}>
                          <IonButton
                            fill="clear"
                            color="danger"
                            onClick={() => {
                              setError(null)
                              // Clear the file input
                              const fileInput = document.getElementById('file-upload') as HTMLInputElement
                              if (fileInput) fileInput.value = ''
                            }}
                          >
                            Try Again
                          </IonButton>
                        </div>
                      </IonText>
                    </IonCardContent>
                  </IonCard>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle>How to Export from Chase</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText className="font-body">
                <ol>
                  <li>Log in to your Chase online banking</li>
                  <li>Go to your account activity</li>
                  <li>Select the date range you want to export</li>
                  <li>Click "Export" and choose CSV format</li>
                  <li>Upload the downloaded file above</li>
                </ol>
              </IonText>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}

export default UploadPage