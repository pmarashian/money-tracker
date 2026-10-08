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
      <IonContent className="rr-loader-content">
        <RetroLoaderViewport>
          {showLoader ? <RetroLoader label={label} /> : null}
        </RetroLoaderViewport>
      </IonContent>
    </IonPage>
  );
}

/** Full-screen boot/auth gate (no tab header). */
export function RetroLoaderScreen({
  label = 'LOADING',
  showLoader = true,
}: {
  label?: string;
  showLoader?: boolean;
}) {
  return (
    <div className="rr-loader-screen" aria-busy={showLoader}>
      {showLoader ? <RetroLoader label={label} /> : null}
    </div>
  );
}
