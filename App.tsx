import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { POSTHOG_API_KEY, POSTHOG_HOST, initServices } from './src/services/analyticsAndBilling';
import { bumpSession } from './src/storage/preferences';
import { colors } from './src/theme/colors';

function LinkPurchasesIdentity() {
  const posthog = usePostHog();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !posthog) return;
    started.current = true;
    void initServices(posthog).catch(() => undefined);
  }, [posthog]);

  return null;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    void bumpSession();
    void initServices().catch(() => undefined);
  }, []);

  if (!fontsLoaded && !fontError) {
    return <View style={styles.boot} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PostHogProvider
          apiKey={POSTHOG_API_KEY}
          autocapture={{ captureScreens: false }}
          options={{ host: POSTHOG_HOST, captureAppLifecycleEvents: true }}
        >
          <LinkPurchasesIdentity />
          <RootNavigator />
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
});
