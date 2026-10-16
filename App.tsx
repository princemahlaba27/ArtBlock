import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider } from 'posthog-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { POSTHOG_API_KEY, POSTHOG_HOST, initServices } from './src/services/analyticsAndBilling';
import { bumpSession } from './src/storage/preferences';

export default function App() {
  useEffect(() => {
    void bumpSession();
    void initServices().catch(() => undefined);
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PostHogProvider
          apiKey={POSTHOG_API_KEY}
          options={{ host: POSTHOG_HOST, captureAppLifecycleEvents: true }}
        >
          <RootNavigator />
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
