'use client'

import { IonApp } from '@ionic/react'
import { setupIonicReact } from '@ionic/react'

// Setup Ionic React with dark mode
setupIonicReact({
  mode: 'ios',
})

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