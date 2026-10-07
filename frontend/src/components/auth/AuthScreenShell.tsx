import { IonContent, IonPage } from '@ionic/react';
import type { ReactNode } from 'react';

interface AuthScreenShellProps {
  subtitle: string;
  children: ReactNode;
}

export function AuthScreenShell({ subtitle, children }: AuthScreenShellProps) {
  return (
    <IonPage className="rr-app auth-screen">
      <IonContent className="auth-screen__content" scrollY>
        <div className="auth-screen__wrap">
          <header className="auth-screen__brand">
            <img
              src="/images/money-bag.png"
              alt=""
              className="auth-screen__logo"
              width={80}
              height={80}
            />
            <h1 className="auth-screen__title">MONEY TRACKER</h1>
            <p className="auth-screen__subtitle">{subtitle}</p>
          </header>
          {children}
        </div>
      </IonContent>
    </IonPage>
  );
}
