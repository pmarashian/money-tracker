import React, { useState } from "react";
import {
  IonContent,
  IonPage,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonLoading,
} from "@ionic/react";
import { Link } from "react-router-dom";
import { apiPost } from "../lib/api";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    const result = await apiPost<{ message?: string }>(
      "/api/auth/forgot-password",
      { email }
    );

    setLoading(false);
    if (result.ok) {
      setSuccess(true);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div style={{ paddingTop: "5rem" }}>
          <div className="ion-text-center" style={{ marginBottom: "1.5rem" }}>
            <img
              src="/images/money-bag.png"
              alt="Money Tracker"
              style={{
                height: "80px",
                width: "auto",
                display: "block",
                margin: "0 auto",
              }}
            />
          </div>

          <div className="ion-text-center ion-margin-bottom">
            <p className="font-body">Forgot password</p>
          </div>

          {success ? (
            <div className="ion-text-center ion-padding">
              <IonText>
                If an account exists with this email, you&apos;ll receive a reset
                link. Check your inbox.
              </IonText>
              <div className="ion-margin-top">
                <Link to="/reset-password">Go to reset password page</Link>
                {" · "}
                <Link to="/login">Back to Sign In</Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <IonItem>
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput
                    type="email"
                    value={email}
                    onIonInput={(e) => setEmail(e.detail.value ?? "")}
                    required
                    placeholder="Enter your email"
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  type="submit"
                  className="ion-margin-top"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </IonButton>
              </form>

              <div className="ion-text-center ion-margin-top">
                <IonText color="medium">
                  <Link to="/login">Back to Sign In</Link>
                </IonText>
              </div>
            </>
          )}
        </div>

        <IonLoading isOpen={loading} message="Sending..." />
      </IonContent>
    </IonPage>
  );
};

export default ForgotPassword;
