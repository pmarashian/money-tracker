import { useEffect } from "react";
import {
  IonApp,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from "@ionic/react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";

import { home, list, settings } from "ionicons/icons";
import Home from "./pages/Home";
import Expenses from "./pages/Expenses";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppBackgroundProvider, useAppBackground } from "./hooks/useAppBackground";
import ProtectedRoute from "./components/ProtectedRoute";
import { RetroLoaderScreen } from "./components/RetroLoaderPage";
import { useRetroPageLoading } from "./hooks/useRetroPageLoading";
import logger from "./lib/logger";
import DevRetroLoaderPreview from "./pages/DevRetroLoaderPreview";

const InitialRoute: React.FC = () => {
  const { user, loading } = useAuth();

  const { showLoader, blocking } = useRetroPageLoading(loading);

  if (blocking) {
    return showLoader ? <RetroLoaderScreen label="LOADING" /> : null;
  }

  // Redirect based on authentication state
  if (user) {
    // logger.info('[App] Initial route: user authenticated, redirecting to /app/home');
    return <Navigate to="/app/home" replace />;
  }

  // logger.info('[App] Initial route: user not authenticated, redirecting to /login');
  return <Navigate to="/login" replace />;
};

const TabBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAppRoute = location.pathname.startsWith("/app");
  const path = location.pathname;

  if (!isAppRoute) {
    return null;
  }

  return (
    <IonTabBar
      className="app-tab-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <IonTabButton
        tab="home"
        onClick={() => navigate("/app/home")}
        className={
          path === "/app/home" ? "app-tab-bar__btn--active" : undefined
        }
      >
        <IonIcon icon={home} />
        <IonLabel>Home</IonLabel>
      </IonTabButton>
      <IonTabButton
        tab="expenses"
        onClick={() => navigate("/app/expenses")}
        className={
          path === "/app/expenses" ? "app-tab-bar__btn--active" : undefined
        }
      >
        <IonIcon icon={list} />
        <IonLabel>Expenses</IonLabel>
      </IonTabButton>
      <IonTabButton
        tab="settings"
        onClick={() => navigate("/app/settings")}
        className={
          path === "/app/settings" ? "app-tab-bar__btn--active" : undefined
        }
      >
        <IonIcon icon={settings} />
        <IonLabel>Settings</IonLabel>
      </IonTabButton>
    </IonTabBar>
  );
};

const AppContent: React.FC = () => {
  return (
    <Routes>
      {import.meta.env.DEV ? (
        <Route
          path="/dev/retro-loader"
          element={<DevRetroLoaderPreview />}
        />
      ) : null}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<InitialRoute />} />
      <Route
        path="/app/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/expenses"
        element={
          <ProtectedRoute>
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="/app" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
};

const AppBackgroundLayer: React.FC = () => {
  const location = useLocation();
  const { backgroundSrc } = useAppBackground();
  const isAppRoute = location.pathname.startsWith("/app");

  if (!isAppRoute) return null;

  return (
    <div
      className="app-route-background"
      aria-hidden
      style={
        backgroundSrc
          ? { backgroundImage: `url(${backgroundSrc})` }
          : { backgroundImage: "none" }
      }
    />
  );
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");
  const { backgroundSrc } = useAppBackground();
  const mainClass = [
    isAppRoute ? "has-tab-bar" : undefined,
    isAppRoute ? "app-main--with-bg" : undefined,
    isAppRoute && !backgroundSrc ? "app-main--plain-black" : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <AppBackgroundLayer />
    <div
      id="main"
      className={mainClass || undefined}
      style={{
        flex: 1,
        height: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <AppContent />
    </div>
    </>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // logger.info('[App] App component mounted');

    return () => {
      // logger.info('[App] App component unmounting');
    };
  }, []);

  return (
    <IonApp
      style={{
        margin: 0,
        padding: 0,
        height: "100vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AuthProvider>
        <AppBackgroundProvider>
          <RouterWrapper>
            <MainLayout />
            <TabBar />
          </RouterWrapper>
        </AppBackgroundProvider>
      </AuthProvider>
    </IonApp>
  );
};

function parseResetPasswordUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const pathPart = (url.hostname || url.pathname || "").toLowerCase();
    const token = url.searchParams.get("token");
    if (pathPart.includes("reset-password") && token) {
      return token;
    }
  } catch {
    // ignore invalid URLs
  }
  return null;
}

const DeepLinkHandler: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleUrl = (url: string) => {
      const token = parseResetPasswordUrl(url);
      if (token) {
        navigate(`/reset-password?token=${encodeURIComponent(token)}`, {
          replace: true,
        });
      }
    };

    const listener = CapacitorApp.addListener("appUrlOpen", (event) => {
      handleUrl(event.url);
    });

    CapacitorApp.getLaunchUrl()
      .then((result) => {
        if (result?.url) {
          handleUrl(result.url);
        }
      })
      .catch(() => {});

    return () => {
      listener.then((l) => l.remove()).catch(() => {});
    };
  }, [navigate]);

  return <>{children}</>;
};

const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    // logger.info('[App] Router initialized');

    return () => {
      // logger.info('[App] Router unmounting');
    };
  }, []);

  return (
    <Router>
      <DeepLinkHandler>{children}</DeepLinkHandler>
    </Router>
  );
};

export default App;
