'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonButton, IonInput, IonSpinner, IonText } from '@ionic/react'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { checkAuth, User } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default function UploadPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUserAuth = async () => {
      const authenticatedUser = await checkAuth()
      setUser(authenticatedUser)
      setLoading(false)

      if (!authenticatedUser) {
        router.push('/login')
      }
    }

    checkUserAuth()
  }, [router])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    setUploading(true)
    setError(null)
    setUploadStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/transactions/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        setUploadStatus(`Successfully uploaded ${result.transactionCount || 0} transactions`)

        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }

        // Refresh the expenses data (could trigger a global refresh)
        setTimeout(() => {
          setUploadStatus(null)
        }, 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner name="circular" />
          <p>Loading...</p>
        </IonContent>
      </IonPage>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle className="font-heading">Upload CSV</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto space-y-4">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="font-heading text-sm">Upload Chase CSV</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-body text-xs text-gray-400 mb-3">
                    Upload your Chase bank CSV file to automatically detect recurring expenses and calculate financial health.
                  </p>

                  <div className="space-y-2">
                    <p className="font-body text-xs font-medium">Expected CSV format:</p>
                    <ul className="font-body text-xs text-gray-500 space-y-1 ml-4">
                      <li>• Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #</li>
                      <li>• Dates in MM/DD/YYYY format</li>
                      <li>• Negative amounts = expenses, positive = income</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="csv-upload"
                  />

                  <IonButton
                    expand="block"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <IonSpinner slot="start" name="circular" />
                        Uploading...
                      </>
                    ) : (
                      'Select CSV File'
                    )}
                  </IonButton>
                </div>

                {error && (
                  <div className="bg-red-900 border border-red-700 rounded-lg p-3">
                    <IonText color="danger">
                      <p className="font-body text-xs">{error}</p>
                    </IonText>
                  </div>
                )}

                {uploadStatus && (
                  <div className="bg-green-900 border border-green-700 rounded-lg p-3">
                    <IonText color="success">
                      <p className="font-body text-xs">{uploadStatus}</p>
                    </IonText>
                  </div>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardContent>
              <p className="font-body text-xs text-gray-500 text-center">
                Your data is processed securely and stored privately.
                Only you can access your financial information.
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  )
}