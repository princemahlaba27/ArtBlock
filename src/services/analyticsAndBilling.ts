import type { PostHog } from 'posthog-react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

export const REVENUECAT_APPLE_KEY = 'appl_yQcMnGhOsWuCOPCYQijkTuiHrkv';

/**
 * Public write-only PostHog project key. It is read from .env.local
 * (gitignored) and is not stored in source. The app still has to send this
 * key with events, so it is inlined into the bundle at start.
 */
export const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let servicesReady: Promise<void> | null = null;
let purchasesLinked = false;

const configurePurchases = async () => {
  if (Platform.OS !== 'ios') return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  await Purchases.configure({ apiKey: REVENUECAT_APPLE_KEY });
};

/**
 * Configures RevenueCat on iOS once. When a PostHog client is passed, links
 * that same client's distinct id onto Purchases after configure. Web skips
 * the attribute write because Purchases is not configured there.
 */
export const initServices = async (posthog?: PostHog | null) => {
  if (!servicesReady) {
    servicesReady = configurePurchases();
  }
  await servicesReady;
  if (purchasesLinked || Platform.OS !== 'ios' || !posthog) return;
  purchasesLinked = true;
  try {
    await posthog.ready();
    const distinctId = posthog.getDistinctId();
    if (!distinctId) return;
    Purchases.setAttributes({ posthog_distinct_id: distinctId });
  } catch {
    // Purchases is not configured on this runtime.
  }
};
