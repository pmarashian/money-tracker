import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupIonicReact } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import App from './App';
import logger from './lib/logger';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

/* Dark Minimalist Theme */
import './theme/dark-minimalist.css';

setupIonicReact();

// Detect platform
const platform = Capacitor.isNativePlatform() ? 'native' : 'web';
const platformName = Capacitor.getPlatform();

// Initialize logger
logger.info('[App] Initializing application', {
  platform,
  platformName,
  isNative: Capacitor.isNativePlatform(),
});

// Flush logs on page unload
window.addEventListener('beforeunload', () => {
  logger.info('[App] App unloading - flushing logs', {
    platform,
    platformName,
  });
  logger.flush().catch(() => {
    // Ignore flush errors on unload
  });
});

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);