import { IonApp, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const App: React.FC = () => {
  return (
    <IonApp>
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          <IonHeader collapse="condense">
            <IonToolbar>
              <IonTitle size="large">Money Tracker</IonTitle>
            </IonToolbar>
          </IonHeader>
          <div className="ion-padding">
            <h1>Welcome to Money Tracker</h1>
            <p>Track your expenses and manage your budget with this Ionic React app.</p>
          </div>
        </IonContent>
      </IonPage>
    </IonApp>
  );
};

export default App;