type VapidKeyResponse = { success: true; publicKey: string } | { success: false; error: string };

type SubscribeResponse = { success: true } | { success: false; error: string };

type ScheduleResponse =
  | { success: true; id: string }
  | { success: false; error: string };

type CancelResponse = { success: true } | { success: false; error: string };

export type PushPayload = {
  title: string;
  body?: string;
  tag?: string;
  url?: string;
  icon?: string;
  badge?: string;
};

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

function getOrCreateClientId(): string {
  const key = 'crumbClientId';
  const existing = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  if (existing && existing.trim().length) return existing;

  const created =
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `c_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  try {
    localStorage.setItem(key, created);
  } catch {
    // ignore
  }

  return created;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-public-key');
  const json = (await res.json()) as VapidKeyResponse;
  if (!json.success) throw new Error(json.error || 'Failed to load VAPID public key');
  return json.publicKey;
}

async function ensurePushSubscription(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('Push not supported');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const publicKey = await fetchVapidPublicKey();
  return await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });
}

export async function ensurePushEnabled(): Promise<{ clientId: string; subscription: PushSubscription }> {
  const subscription = await ensurePushSubscription();
  const clientId = getOrCreateClientId();

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, subscription: subscription.toJSON() })
  });

  const json = (await res.json()) as SubscribeResponse;
  if (!json.success) throw new Error(json.error || 'Failed to register push subscription');

  return { clientId, subscription };
}

export async function schedulePush({ fireAtMs, payload }: { fireAtMs: number; payload: PushPayload }): Promise<string> {
  const { clientId } = await ensurePushEnabled();

  const res = await fetch('/api/push/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, fireAtMs, payload })
  });

  const json = (await res.json()) as ScheduleResponse;
  if (!json.success) throw new Error(json.error || 'Failed to schedule push');
  return json.id;
}

export async function cancelScheduledPush(id: string): Promise<void> {
  if (!id) return;
  const res = await fetch('/api/push/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const json = (await res.json()) as CancelResponse;
  if (!json.success) throw new Error(json.error || 'Failed to cancel push');
}
