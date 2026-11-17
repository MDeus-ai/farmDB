import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AlertNotificationPayload } from '@farmdb/db';

let handlerConfigured = false;

export function ensureMobileNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === 'web') {
    return;
  }
  handlerConfigured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore on unsupported runtimes.
  }
}

export async function ensureMobileNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  ensureMobileNotificationHandler();

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('farmdb-alerts', {
        name: 'FarmDB Livestock Alerts',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return requested.granted;
  } catch {
    return false;
  }
}

export async function dispatchMobileNotification(
  payload: Pick<AlertNotificationPayload, 'title' | 'body'>
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true;
  }

  try {
    const granted = await ensureMobileNotificationPermissions();
    if (granted) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: 'default',
        },
        trigger: null,
      });
    }
  } catch {
    // Allow in-app banner handling even when OS notifications are unavailable.
  }

  return true;
}
