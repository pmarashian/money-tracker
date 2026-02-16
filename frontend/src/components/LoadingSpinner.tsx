import React from 'react';
import { IonSpinner, IonContent } from '@ionic/react';

const LoadingSpinner: React.FC = () => {
  return (
    <IonContent
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      <IonSpinner name="circular" style={{ transform: 'scale(1.5)' }} />
    </IonContent>
  );
};

export default LoadingSpinner;