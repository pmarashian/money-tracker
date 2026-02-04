import { IonApp, IonRouterOutlet, IonSplitPane } from '@ionic/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Route, Navigate } from 'react-router-dom';
import Menu from './components/Menu';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <IonApp>
      <AuthProvider>
        <Router>
          <IonSplitPane contentId="main">
            <Menu />
            <IonRouterOutlet id="main">
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </IonRouterOutlet>
          </IonSplitPane>
        </Router>
      </AuthProvider>
    </IonApp>
  );
};

export default App;