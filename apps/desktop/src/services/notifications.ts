import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import type { AlertNotificationPayload } from '@farmdb/db';
import { isTauriEnvironment } from './imageStorage';

export async function dispatchDesktopNotification(
  payload: Pick<AlertNotificationPayload, 'title' | 'body'>
): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const perm = await requestPermission();
        granted = perm === 'granted';
      }
      if (granted) {
        sendNotification({
          title: payload.title,
          body: payload.body,
        });
      }
    } catch {
      // Even if OS toast permission is denied, allow in-app banner delivery.
    }
    return true;
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (window.Notification.permission === 'granted') {
        new window.Notification(payload.title, { body: payload.body });
      }
    } catch {
      // Ignore browser notification restrictions.
    }
  }

  return true;
}
