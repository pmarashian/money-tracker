'use client'

import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react'

export function HomePage() {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Welcome to Money Tracker</h1>
          <p className="text-gray-600 mb-4">
            Track your finances with ease using our Next.js + Ionic + Capacitor app.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  )
}