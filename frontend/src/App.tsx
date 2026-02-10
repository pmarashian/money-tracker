import {
  IonApp,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import {
  home,
  list,
  settings
} from 'ionicons/icons';
import Home from './pages/Home';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

const TabBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAppRoute = location.pathname.startsWith('/app');
  const path = location.pathname;

  if (!isAppRoute) {
    return null;
  }

  return (
    <IonTabBar className="app-tab-bar" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000
    }}>
      <IonTabButton
        tab="home"
        onClick={() => navigate('/app/home')}
        className={path === '/app/home' ? 'app-tab-bar__btn--active' : undefined}
      >
        <IonIcon icon={home} />
        <IonLabel>Home</IonLabel>
      </IonTabButton>
      <IonTabButton
        tab="expenses"
        onClick={() => navigate('/app/expenses')}
        className={path === '/app/expenses' ? 'app-tab-bar__btn--active' : undefined}
      >
        <IonIcon icon={list} />
        <IonLabel>Expenses</IonLabel>
      </IonTabButton>
      <IonTabButton
        tab="settings"
        onClick={() => navigate('/app/settings')}
        className={path === '/app/settings' ? 'app-tab-bar__btn--active' : undefined}
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/app/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/app/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/app" element={<Navigate to="/app/home" replace />} />
    </Routes>
  );
};

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith('/app');

  return (
    <div
      id="main"
      className={isAppRoute ? 'has-tab-bar' : undefined}
      style={{
        flex: 1,
        height: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      <AppContent />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <IonApp style={{
      margin: 0,
      padding: 0,
      height: '100vh',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <AuthProvider>
        <Router>
          <MainLayout />
          <TabBar />
        </Router>
      </AuthProvider>
    </IonApp>
  );
};

export default App;