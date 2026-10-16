import type { PostHog } from 'posthog-react-native';

type AnalyticsClient = Pick<PostHog, 'capture'> | null | undefined;

/** Dev builds print the event. A missing client or a failed send never throws. */
export function logEvent(
  client: AnalyticsClient,
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  try {
    if (__DEV__) {
      console.log(event, properties ?? {});
    }
    client?.capture(event, properties);
  } catch {
    // Telemetry is optional. The screen keeps going.
  }
}
