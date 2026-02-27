import React, { useState, useEffect } from "react";
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
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// import logger from "../lib/logger";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();
  const { login, user, loading: authLoading } = useAuth();

  // Redirect to app if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      // logger.info("[Login] User already authenticated, redirecting to app");
      navigate("/app/home", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(email, password);
    if (result.success) {
      navigate("/app/home");
    } else {
      setError(result.error || "Login failed");
      setShowAlert(true);
    }
    setLoading(false);
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
            <p className="font-body">Sign in</p>
          </div>

          <form onSubmit={handleLogin}>
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

            <IonItem>
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? "")}
                required
                placeholder="Enter your password"
              />
            </IonItem>

            <IonButton
              expand="block"
              type="submit"
              className="ion-margin-top"
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
            </IonButton>

            <div className="ion-text-center ion-margin-top">
              <IonText color="medium">
                <Link to="/forgot-password">Forgot password?</Link>
              </IonText>
              <br />
              <IonText color="medium">
                <Link to="/reset-password">Already have a reset code?</Link>
              </IonText>
            </div>
          </form>

          <div className="ion-text-center ion-margin-top">
            <IonText color="medium">
              Don't have an account? <Link to="/register">Sign Up</Link>
            </IonText>
          </div>
        </div>

        <IonLoading isOpen={loading} message="Signing in..." />
        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header="Login Failed"
          message={error}
          buttons={["OK"]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
