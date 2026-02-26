import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IonPage, IonContent, IonSpinner, IonText } from '@ionic/react';
import { apiPost } from '../lib/api';

/**
 * Teller Connect redirect target. Teller redirects here with enrollment_id and access_token.
 * We POST them to the backend and redirect to Settings.
 */
const TellerCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const enrollmentId = searchParams.get('enrollment_id') ?? searchParams.get('enrollmentId');
    const accessToken = searchParams.get('access_token') ?? searchParams.get('accessToken');

    if (!enrollmentId || !accessToken) {
      setStatus('error');
      setErrorMessage('Missing connection details. Redirecting to settings.');
      setTimeout(() => navigate('/app/settings', { replace: true }), 2000);
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await apiPost<{ success?: boolean }>('/api/teller/callback', {
        enrollment_id: enrollmentId,
        access_token: accessToken,
        institution_name: searchParams.get('institution_name') ?? searchParams.get('institutionName'),
      });

      if (cancelled) return;

      if (result.ok && result.data) {
        setStatus('done');
        navigate('/app/settings?linked=1', { replace: true });
      } else {
        setStatus('error');
        setErrorMessage(result.error ?? 'Failed to link bank. Redirecting to settings.');
        setTimeout(() => navigate('/app/settings', { replace: true }), 3000);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  return (
    <IonPage>
      <IonContent className="ion-padding ion-text-center">
        {status === 'processing' && (
          <>
            <IonSpinner name="crescent" />
            <IonText color="medium">
              <p className="font-body">Linking your bank account...</p>
            </IonText>
          </>
        )}
        {status === 'done' && (
          <IonText color="medium">
            <p className="font-body">Bank linked. Redirecting to settings...</p>
          </IonText>
        )}
        {status === 'error' && (
          <IonText color="danger">
            <p className="font-body">{errorMessage}</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TellerCallback;
