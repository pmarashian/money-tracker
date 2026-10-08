import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { RetroLoader, RetroLoaderViewport } from './RetroLoader';

export type RetroLoaderPageProps = {
  title?: string;
  label?: string;
  /** When false, only header + empty centered area (delay before loader appears). */
  showLoader?: boolean;
  showHeader?: boolean;
};

export function RetroLoaderPage({
  title,
  label = 'LOADING',
  showLoader = true,
  showHeader = true,
}: RetroLoaderPageProps) {
  return (
    <IonPage className="rr-app">
      {showHeader && title ? (
        <IonHeader>
          <IonToolbar>
            <IonTitle>{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
      ) : null}
      <IonContent>
        <RetroLoaderViewport>
          {showLoader ? <RetroLoader label={label} /> : null}
        </RetroLoaderViewport>
      </IonContent>
    </IonPage>
  );
}

/** Full-screen boot/auth gate (no tab header). */
export function RetroLoaderScreen({ label = 'LOADING' }: { label?: string }) {
  return (
    <div className="rr-loader-screen">
      <RetroLoader label={label} />
    </div>
  );
}
