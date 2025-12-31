export type TimerNotificationOptions = {
  title: string;
  body?: string;
  tag?: string;
};

export function isNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function canUseServiceWorkerNotifications(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationsSupported()) return 'denied';

  // If already decided, don't prompt.
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

async function getServiceWorkerRegistrationSafe(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorkerNotifications()) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Show a notification using the service worker registration when possible.
 *
 * This improves reliability when the app/tab is in the background.
 * Note: If the PWA is fully closed, browsers generally do NOT allow arbitrary scheduled alarms
 * without push notifications. This covers "backgrounded" (not focused) scenarios.
 */
export async function showTimerNotification(opts: TimerNotificationOptions): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const title = opts.title || 'Timer done';
  const body = opts.body;

  const icon = '/crumbworks-192x192.png';

  const registration = await getServiceWorkerRegistrationSafe();
  if (registration?.showNotification) {
    try {
      // TS DOM typings vary by version; allow additional fields via index signature.
      const options: NotificationOptions & { [key: string]: unknown } = {
        body,
        tag: opts.tag,
        icon,
        // These are supported in many browsers / PWAs (especially Android),
        // but may not exist in older TS lib.dom typings.
        badge: icon,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: typeof location !== 'undefined' ? location.href : undefined
        }
      };

      await registration.showNotification(title, options);
      return true;
    } catch {
      // fall through to in-page notification
    }
  }

  try {
    // Fallback: in-page Notification.
    new Notification(title, { body, tag: opts.tag, icon });
    return true;
  } catch {
    return false;
  }
}
