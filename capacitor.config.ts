import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moneytracker.app',
  appName: 'Money Tracker',
  webDir: 'frontend/dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;