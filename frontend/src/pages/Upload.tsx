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

const UploadPage: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const history = useHistory()

  useEffect(() => {
    // Check if user is logged in
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/auth/session', {
        credentials: 'include',
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
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

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:3002/api/transactions/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Upload successful:', result)
        // Show success message or redirect
      } else {
        console.error('Upload failed')
        // Show error message
      }
    } catch (err) {
      console.error('Upload error:', err)
      // Show error message
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