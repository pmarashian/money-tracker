import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

const Home: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Money Tracker</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Money Tracker</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Welcome to Money Tracker</h1>
          <p className="font-body">You are successfully logged in! Track your expenses and manage your budget.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Home;