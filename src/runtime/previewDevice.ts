import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** A phone simulator or the browser preview has no store purchase and no camera feed. */
export function isPreviewDevice(): boolean {
  return Platform.OS === 'web' || !Device.isDevice;
}
