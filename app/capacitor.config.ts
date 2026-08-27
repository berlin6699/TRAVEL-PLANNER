import type { CapacitorConfig } from '@capacitor/cli'
import type {} from '@capacitor/local-notifications'

const config: CapacitorConfig = {
  appId: 'com.berlin6699.travelplanner',
  appName: '旅途',
  webDir: 'dist',
  backgroundColor: '#f7f5ef',
  android: {
    backgroundColor: '#f7f5ef',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#26251f',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f7f5ef',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_travel_notification',
      iconColor: '#ff7a61',
      presentationOptions: ['sound', 'banner', 'list'],
    },
  },
}

export default config
