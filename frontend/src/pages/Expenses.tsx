import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

const Expenses: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Expenses</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Expenses</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Expenses</h1>
          <p className="font-body">View and manage your expenses.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Expenses;