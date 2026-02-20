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
  IonAlert,
} from "@ionic/react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiPost } from "../lib/api";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setShowAlert(true);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setShowAlert(true);
      return;
    }

    setLoading(true);

    const body = token
      ? { token, newPassword }
      : { email, code, newPassword };

    const result = await apiPost<{ success?: boolean; message?: string }>(
      "/api/auth/reset-password",
      body
    );

    setLoading(false);

    if (result.ok && result.data?.success) {
      navigate("/login", { replace: true });
    } else {
      setError(
        result.error ??
          (token ? "Invalid or expired reset link." : "Invalid or expired reset code.")
      );
      setShowAlert(true);
    }
  };

  const showCodeForm = !token;

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
            <p className="font-body">Reset password</p>
          </div>

          {showCodeForm && (
            <p className="ion-text-center ion-margin-bottom ion-margin-horizontal font-body" style={{ fontSize: "0.9rem" }}>
              Enter the code from your email and the email address you used to request the reset.
            </p>
          )}

          {showCodeForm && (
            <p className="ion-text-center ion-margin-bottom ion-margin-horizontal" style={{ fontSize: "0.85rem" }}>
              <IonText color="medium">
                If you have a reset link, open it to skip entering the code.
              </IonText>
            </p>
          )}

          {!showCodeForm && (
            <p className="ion-text-center ion-margin-bottom ion-margin-horizontal font-body" style={{ fontSize: "0.9rem" }}>
              You&apos;re using the reset link. Enter your new password below.
            </p>
          )}

          {!showCodeForm && (
            <p className="ion-text-center ion-margin-bottom ion-margin-horizontal" style={{ fontSize: "0.85rem" }}>
              <IonText color="medium">
                Prefer to use the code from your email?{" "}
                <Link to="/reset-password" replace>Use code instead</Link>
              </IonText>
            </p>
          )}

          <form onSubmit={handleSubmit}>
            {showCodeForm && (
              <>
                <IonItem>
                  <IonLabel position="stacked">Email</IonLabel>
                  <IonInput
                    type="email"
                    value={email}
                    onIonInput={(e) => setEmail(e.detail.value ?? "")}
                    required
                    placeholder="Email you requested reset for"
                  />
                </IonItem>
                <IonItem>
                  <IonLabel position="stacked">Reset code</IonLabel>
                  <IonInput
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onIonInput={(e) => setCode((e.detail.value ?? "").replace(/\D/g, "").slice(0, 6))}
                    required
                    placeholder="6-digit code from email"
                  />
                </IonItem>
              </>
            )}

            <IonItem>
              <IonLabel position="stacked">New password</IonLabel>
              <IonInput
                type="password"
                value={newPassword}
                onIonInput={(e) => setNewPassword(e.detail.value ?? "")}
                required
                placeholder="Enter new password"
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Confirm password</IonLabel>
              <IonInput
                type="password"
                value={confirmPassword}
                onIonInput={(e) => setConfirmPassword(e.detail.value ?? "")}
                required
                placeholder="Confirm new password"
              />
            </IonItem>

            <IonButton
              expand="block"
              type="submit"
              className="ion-margin-top"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset password"}
            </IonButton>
          </form>

          {showCodeForm && (
            <div className="ion-text-center ion-margin-top">
              <Link to="/forgot-password">Request new code</Link>
              {" · "}
              <Link to="/login">Sign In</Link>
            </div>
          )}

          {!showCodeForm && (
            <div className="ion-text-center ion-margin-top">
              <IonText color="medium">
                <Link to="/login">Back to Sign In</Link>
              </IonText>
            </div>
          )}
        </div>

        <IonLoading isOpen={loading} message="Resetting password..." />
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Reset failed"
          message={error}
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
