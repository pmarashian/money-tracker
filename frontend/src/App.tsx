import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Route, Routes, Navigate } from 'react-router-dom';
import {
  home,
  list,
  cloudUpload,
  chatbubble,
  settings
} from 'ionicons/icons';
import Menu from './components/Menu';
import Home from './pages/Home';
import Expenses from './pages/Expenses';
import Upload from './pages/Upload';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

const AppTabs: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<Navigate to="/app/home" replace />} />
      </Routes>

      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/app/home">
          <IonIcon icon={home} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>
        <IonTabButton tab="expenses" href="/app/expenses">
          <IonIcon icon={list} />
          <IonLabel>Expenses</IonLabel>
        </IonTabButton>
        <IonTabButton tab="upload" href="/app/upload">
          <IonIcon icon={cloudUpload} />
          <IonLabel>Upload</IonLabel>
        </IonTabButton>
        <IonTabButton tab="chat" href="/app/chat">
          <IonIcon icon={chatbubble} />
          <IonLabel>Chat</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/app/settings">
          <IonIcon icon={settings} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </>
  );
};

const App: React.FC = () => {
  return (
    <IonApp>
      <AuthProvider>
        <Router>
          <IonSplitPane contentId="main">
            <Menu />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/app/*" element={<ProtectedRoute><AppTabs /></ProtectedRoute>} />
            </Routes>
          </IonSplitPane>
        </Router>
      </AuthProvider>
    </IonApp>
  );
};

export default App;