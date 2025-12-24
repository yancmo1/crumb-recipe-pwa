/**
 * Client-side service worker timer utilities.
 * 
 * These provide background notification support for timers without requiring
 * a configured server-side Web Push setup. The service worker keeps timers
 * running even when the page is backgrounded or the device is locked.
 */

export type ServiceWorkerTimerNotification = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
};

/**
 * Schedule a timer notification via the service worker.
 * This allows notifications to fire even when the app is backgrounded/locked.
 * 
 * @returns Timer ID that can be used to cancel the timer
 */
export async function scheduleServiceWorkerTimer(
  fireAtMs: number,
  notification: ServiceWorkerTimerNotification
): Promise<string> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) {
    throw new Error('No active service worker');
  }

  // Generate a unique ID for this timer
  const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  registration.active.postMessage({
    type: 'schedule-timer',
    id,
    fireAtMs,
    notification
  });

  return id;
}

/**
 * Cancel a scheduled service worker timer.
 */
export async function cancelServiceWorkerTimer(id: string): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (!registration.active) {
    return;
  }

  registration.active.postMessage({
    type: 'cancel-timer',
    id
  });
}
