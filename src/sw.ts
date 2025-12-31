/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

// Precache assets injected by VitePWA.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Runtime caching: images.
registerRoute(
  ({ url }) => url.origin.startsWith('https://') && /\.(png|jpg|jpeg|svg|webp)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 7 * 24 * 60 * 60
      })
    ]
  })
);

// Runtime caching: API (prefer network, fallback to cache).
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60
      })
    ]
  })
);

// Push notifications (Web Push) for background/locked alerts.
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'Timer done', body: event.data?.text?.() };
    }
  })() as {
    title?: string;
    body?: string;
    tag?: string;
    url?: string;
    icon?: string;
    badge?: string;
  };

  const title = data.title || 'Timer done';
  const icon = data.icon || '/crumbworks-192x192.png';
  const badge = data.badge || '/crumbworks-192x192.png';

  const options: NotificationOptions & { [key: string]: unknown } = {
    body: data.body,
    tag: data.tag,
    icon,
    badge,
    // Some platforms may ignore these, but they help where supported.
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string } | undefined)?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (const client of allClients) {
        // Focus any existing tab/window.
        if ('focus' in client) {
          await client.focus();
          // If we can navigate, do so; otherwise just focus.
          if ('navigate' in client) {
            try {
              await client.navigate(url);
            } catch {
              // Ignore.
            }
          }
          return;
        }
      }

      // No open window; open a new one.
      await self.clients.openWindow(url);
    })()
  );
});

// Client-side timer storage for background notifications
// (fallback when server-side push isn't configured or available)
const activeTimers = new Map<string, NodeJS.Timeout>();

type TimerMessage = {
  type: 'schedule-timer';
  id: string;
  fireAtMs: number;
  notification: {
    title: string;
    body?: string;
    tag?: string;
    url?: string;
  };
};

type CancelTimerMessage = {
  type: 'cancel-timer';
  id: string;
};

// Handle messages from the client to schedule/cancel timers
self.addEventListener('message', (event) => {
  const msg = event.data as TimerMessage | CancelTimerMessage;

  if (msg.type === 'schedule-timer') {
    // Cancel any existing timer with this ID
    const existing = activeTimers.get(msg.id);
    if (existing) {
      clearTimeout(existing);
      activeTimers.delete(msg.id);
    }

    const delay = Math.max(0, msg.fireAtMs - Date.now());
    
    // Service workers can be terminated, so this isn't 100% reliable for very long timers,
    // but it works well for cooking timers (typically minutes, not hours).
    // For production, you'd want to combine this with server-side push or periodic background sync.
    const timer = setTimeout(() => {
      activeTimers.delete(msg.id);
      
      const title = msg.notification.title || 'Timer done';
      const icon = '/crumbworks-192x192.png';
      
      const options: NotificationOptions & { [key: string]: unknown } = {
        body: msg.notification.body,
        tag: msg.notification.tag || msg.id,
        icon,
        badge: icon,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: msg.notification.url || '/'
        }
      };

      self.registration.showNotification(title, options);
    }, delay);

    activeTimers.set(msg.id, timer);
  } else if (msg.type === 'cancel-timer') {
    const existing = activeTimers.get(msg.id);
    if (existing) {
      clearTimeout(existing);
      activeTimers.delete(msg.id);
    }
  }
});

// Offline fallback: if a navigation fails, serve the app shell when possible.
setCatchHandler(async ({ event }) => {
  const maybeFetchEvent = event as unknown as FetchEvent;
  const req = maybeFetchEvent?.request;
  if (req && req.destination === 'document') {
    const cached = await caches.match('/index.html');
    if (cached) return cached;
  }
  return Response.error();
});
