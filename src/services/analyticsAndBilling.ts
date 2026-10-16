import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export const REVENUECAT_APPLE_KEY = 'appl_yQcMnGhOsWuCOPCYQijkTuiHrkv';
export const POSTHOG_API_KEY = 'phc_qeS3p69SySUdaJTLm4kmBbGf9h7X5xGQSEenjsuurU5C';
export const POSTHOG_HOST = 'https://us.i.posthog.com';

export const initServices = async () => {
  if (Platform.OS === 'ios') {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey: REVENUECAT_APPLE_KEY });
  }
};
