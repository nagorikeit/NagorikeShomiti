import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nagorikeshomiti.app',
  appName: 'নাগরিক সমিতি',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'nagorikeshomiti.vercel.app',
      '*.vercel.app',
      '*.firebaseapp.com',
      '*.googleapis.com',
      'wa.me'
    ]
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
