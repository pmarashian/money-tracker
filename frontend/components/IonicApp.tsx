'use client'

import { IonApp } from '@ionic/react'
import { setupIonicReact } from '@ionic/react'

// Setup Ionic React
setupIonicReact()

interface IonicAppProps {
  children: React.ReactNode
}

export function IonicApp({ children }: IonicAppProps) {
  return (
    <IonApp>
      {children}
    </IonApp>
  )
}