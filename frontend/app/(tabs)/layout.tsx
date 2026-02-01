'use client'

import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonRouterOutlet } from '@ionic/react'
import { home, list, cloudUpload, chatbubble, settings } from 'ionicons/icons'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  // Handle tab changes
  const handleTabChange = (path: string) => {
    router.push(path)
  }

  return (
    <IonTabs>
      <IonRouterOutlet>
        {children}
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton
          tab="home"
          href="/(tabs)/home"
          selected={pathname === '/(tabs)/home' || pathname === '/'}
          onClick={() => handleTabChange('/(tabs)/home')}
        >
          <IonIcon icon={home} />
        </IonTabButton>

        <IonTabButton
          tab="expenses"
          href="/(tabs)/expenses"
          selected={pathname === '/(tabs)/expenses'}
          onClick={() => handleTabChange('/(tabs)/expenses')}
        >
          <IonIcon icon={list} />
        </IonTabButton>

        <IonTabButton
          tab="upload"
          href="/(tabs)/upload"
          selected={pathname === '/(tabs)/upload'}
          onClick={() => handleTabChange('/(tabs)/upload')}
        >
          <IonIcon icon={cloudUpload} />
        </IonTabButton>

        <IonTabButton
          tab="chat"
          href="/(tabs)/chat"
          selected={pathname === '/(tabs)/chat'}
          onClick={() => handleTabChange('/(tabs)/chat')}
        >
          <IonIcon icon={chatbubble} />
        </IonTabButton>

        <IonTabButton
          tab="settings"
          href="/(tabs)/settings"
          selected={pathname === '/(tabs)/settings'}
          onClick={() => handleTabChange('/(tabs)/settings')}
        >
          <IonIcon icon={settings} />
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  )
}