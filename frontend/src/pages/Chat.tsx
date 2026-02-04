import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

const Chat: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Chat</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Chat</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Chat</h1>
          <p className="font-body">Chat with AI about your financial health and get personalized advice.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Chat;