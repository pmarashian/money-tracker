import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

const Settings: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Settings</h1>
          <p className="font-body">Configure your app preferences and financial settings.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Settings;