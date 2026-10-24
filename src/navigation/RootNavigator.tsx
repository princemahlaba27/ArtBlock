import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from './types';
import { ARCameraTraceScreen } from '../screens/ARCameraTraceScreen';
import { CanvasBuilderScreen } from '../screens/CanvasBuilderScreen';
import { MySketchbookScreen } from '../screens/MySketchbookScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { SketchRevealScreen } from '../screens/SketchRevealScreen';
import { InstantStudioScreen } from '../screens/InstantStudioScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors, fonts } from '../theme/colors';

const ONBOARDING_COMPLETED_KEY = '@artblock_onboarding_completed';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.canvas,
    card: colors.canvas,
    text: colors.ink,
    border: colors.stroke,
    primary: colors.brand,
  },
};

const routeNames: (keyof RootStackParamList)[] = [
  'Welcome',
  'Studio',
  'Settings',
  'Canvas',
  'Paywall',
  'Trace',
  'Reveal',
  'Sketchbook',
];

function isRouteName(name: string | undefined): name is keyof RootStackParamList {
  return routeNames.some((route) => route === name);
}

export default function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [routeName, setRouteName] = useState<keyof RootStackParamList>('Welcome');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY)
      .then((value) => {
        if (!active) return;
        const next: keyof RootStackParamList = value === 'true' ? 'Studio' : 'Welcome';
        setRouteName(next);
        setInitialRoute(next);
      })
      .catch((error: unknown) => {
        console.warn('Onboarding flag could not be read.', error);
        if (!active) return;
        setRouteName('Welcome');
        setInitialRoute('Welcome');
      });
    return () => {
      active = false;
    };
  }, []);

  const syncRoute = () => {
    const name = navigationRef.getCurrentRoute()?.name;
    if (isRouteName(name)) setRouteName(name);
  };

  if (initialRoute === null) {
    return (
      <View style={styles.boot}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const lightStatus =
    routeName === 'Welcome' || routeName === 'Paywall' || routeName === 'Trace';

  return (
    <NavigationContainer ref={navigationRef} theme={theme} onReady={syncRoute} onStateChange={syncRoute}>
      <StatusBar style={lightStatus ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.headingBold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen
          name="Welcome"
          component={OnboardingScreen}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen name="Studio" component={InstantStudioScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Canvas" component={CanvasBuilderScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Paywall"
          component={PaywallScreen}
          options={{ title: 'Your plan', headerShown: false }}
        />
        <Stack.Screen
          name="Trace"
          component={ARCameraTraceScreen}
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="Reveal"
          component={SketchRevealScreen}
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Sketchbook"
          component={MySketchbookScreen}
          options={{ title: 'My Sketchbook' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
});
