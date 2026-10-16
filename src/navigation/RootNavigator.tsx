import {
  NavigationContainer,
  DefaultTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import type { RootStackParamList } from './types';
import { ARCameraTraceScreen } from '../screens/ARCameraTraceScreen';
import { IdeaSpinnerScreen } from '../screens/IdeaSpinnerScreen';
import { MySketchbookScreen } from '../screens/MySketchbookScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { SketchRevealScreen } from '../screens/SketchRevealScreen';
import { colors } from '../theme/colors';

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

export default function RootNavigator() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [routeName, setRouteName] = useState<keyof RootStackParamList>('Ideas');

  const syncRoute = () => {
    const name = navigationRef.getCurrentRoute()?.name;
    if (
      name === 'Ideas' ||
      name === 'Paywall' ||
      name === 'Trace' ||
      name === 'Reveal' ||
      name === 'Sketchbook'
    ) {
      setRouteName(name);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} theme={theme} onReady={syncRoute} onStateChange={syncRoute}>
      <StatusBar style={routeName === 'Trace' ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Ideas"
        screenOptions={{
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="Ideas" component={IdeaSpinnerScreen} options={{ title: 'Ideas' }} />
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
