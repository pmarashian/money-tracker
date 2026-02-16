import React from 'react';
import { IonSpinner } from '@ionic/react';

const LoadingSpinner: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--ion-background-color)',
        zIndex: 9999,
      }}
    >
      <IonSpinner name="circular" style={{ transform: 'scale(1.5)' }} />
    </div>
  );
};

export default LoadingSpinner;