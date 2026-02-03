import React from 'react'
import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, setupIonicReact } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { Route, Redirect } from 'react-router-dom'

setupIonicReact()

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css'

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css'
import '@ionic/react/css/float-elements.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'

/* Theme variables */
import './theme/variables.css'

/* Global styles */
import './globals.css'

// Pages
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import HomePage from './pages/Home'
import ExpensesPage from './pages/Expenses'
import UploadPage from './pages/Upload'
import ChatPage from './pages/Chat'
import SettingsPage from './pages/Settings'

// Components
import PrivateRoute from './components/PrivateRoute'

// Icons
import { home, list, cloudUpload, chatbubble, settings } from 'ionicons/icons'

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonRouterOutlet>
        {/* Routes outside tabs (login/register) */}
        <Route exact path="/login" component={LoginPage} />
        <Route exact path="/register" component={RegisterPage} />

        {/* Main app with tabs */}
        <Route path="/tabs" render={() => (
          <IonTabs>
            <IonRouterOutlet>
              <PrivateRoute exact path="/tabs/home" component={HomePage} />
              <PrivateRoute exact path="/tabs/expenses" component={ExpensesPage} />
              <PrivateRoute exact path="/tabs/upload" component={UploadPage} />
              <PrivateRoute exact path="/tabs/chat" component={ChatPage} />
              <PrivateRoute exact path="/tabs/settings" component={SettingsPage} />
            </IonRouterOutlet>

            <IonTabBar slot="bottom">
              <IonTabButton tab="home" href="/tabs/home">
                <IonIcon icon={home} />
                <IonLabel>Home</IonLabel>
              </IonTabButton>
              <IonTabButton tab="expenses" href="/tabs/expenses">
                <IonIcon icon={list} />
                <IonLabel>Expenses</IonLabel>
              </IonTabButton>
              <IonTabButton tab="upload" href="/tabs/upload">
                <IonIcon icon={cloudUpload} />
                <IonLabel>Upload</IonLabel>
              </IonTabButton>
              <IonTabButton tab="chat" href="/tabs/chat">
                <IonIcon icon={chatbubble} />
                <IonLabel>Chat</IonLabel>
              </IonTabButton>
              <IonTabButton tab="settings" href="/tabs/settings">
                <IonIcon icon={settings} />
                <IonLabel>Settings</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        )} />

        {/* Default redirect */}
        <Route exact path="/">
          <Redirect to="/tabs/home" />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
)

export default App