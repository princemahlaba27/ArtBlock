import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function androidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function notificationGranted(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.status === 'granted';
}

export async function askNotificationPermission(): Promise<boolean> {
  await androidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

export async function scheduleReminder(input: {
  seconds: number;
  title: string;
  body: string;
}): Promise<string> {
  await androidChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, Math.round(input.seconds)),
    },
  });
}
