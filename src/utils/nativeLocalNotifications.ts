import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type NativeTimerNotification = {
  id: number;
  fireAtMs: number;
  title: string;
  body: string;
};

// Single-timer app for now; reserve a stable ID.
export const NATIVE_TIMER_NOTIFICATION_ID = 1001;

export function isNativePlatform(): boolean {
  // Capacitor v5+ supports isNativePlatform(); older versions can use getPlatform().
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap: any = Capacitor;
    if (typeof cap.isNativePlatform === 'function') return Boolean(cap.isNativePlatform());
  } catch {
    // ignore
  }
  return Capacitor.getPlatform() !== 'web';
}

export async function ensureNativeLocalNotificationsPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return true;

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted';
}

export async function cancelNativeTimerNotification(id: number = NATIVE_TIMER_NOTIFICATION_ID): Promise<void> {
  if (!isNativePlatform()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

export async function scheduleNativeTimerNotification(
  notification: Omit<NativeTimerNotification, 'id'> & { id?: number }
): Promise<number> {
  if (!isNativePlatform()) throw new Error('Not running on a native platform');

  const ok = await ensureNativeLocalNotificationsPermission();
  if (!ok) throw new Error('Notification permission not granted');

  const id = typeof notification.id === 'number' ? notification.id : NATIVE_TIMER_NOTIFICATION_ID;

  // Best effort: replace any previous schedule.
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {
    // ignore
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: notification.title,
        body: notification.body,
        schedule: { at: new Date(notification.fireAtMs) }
      }
    ]
  });

  return id;
}
