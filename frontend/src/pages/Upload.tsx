import {
  IonContent,
  IonHeader,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';

const Upload: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonMenuButton slot="start" />
          <IonTitle>Upload</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonMenuButton slot="start" />
            <IonTitle size="large">Upload</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div className="ion-padding">
          <h1 className="font-heading">Upload</h1>
          <p className="font-body">Upload your financial data to analyze your expenses.</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Upload;