import crypto from 'crypto';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || 'mailto:admin@example.com').trim();

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

function configureWebPushOnce() {
  if (!isPushConfigured()) return;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    // If misconfigured, treat as not configured.
    console.warn('Web Push VAPID configuration error:', e);
  }
}

configureWebPushOnce();

/**
 * In-memory timers for scheduled pushes (reconstructed on boot from DB).
 * id -> timeout handle
 */
const timersById = new Map();

function nowMs() {
  return Date.now();
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

async function sendScheduledPush({ query, id, clientId, payload }) {
  // Load subscription for this client.
  const subRes = await query('SELECT subscription FROM push_subscriptions WHERE client_id = $1', [clientId]);
  if (subRes.rows.length === 0) {
    await query(
      "UPDATE push_schedules SET status = 'failed', error = $1, sent_at = $2 WHERE id = $3",
      ['no subscription', nowMs(), id]
    );
    return;
  }

  const subscription = subRes.rows[0].subscription;

  try {
    const payloadWithDefaults = {
      title: payload?.title || 'Timer done',
      body: payload?.body,
      tag: payload?.tag || id,
      url: payload?.url || '/',
      icon: payload?.icon,
      badge: payload?.badge
    };

    await webpush.sendNotification(subscription, JSON.stringify(payloadWithDefaults));

    await query(
      "UPDATE push_schedules SET status = 'sent', sent_at = $1, error = NULL WHERE id = $2",
      [nowMs(), id]
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await query(
      "UPDATE push_schedules SET status = 'failed', error = $1, sent_at = $2 WHERE id = $3",
      [msg, nowMs(), id]
    );
  }
}

function scheduleTimeout({ query, id, clientId, fireAt, payload }) {
  const delay = Math.max(0, fireAt - nowMs());

  // Node timers have a max delay (~24.8 days). Timers here should be short.
  const MAX_DELAY = 2_000_000_000;
  const safeDelay = Math.min(delay, MAX_DELAY);

  const handle = setTimeout(async () => {
    timersById.delete(id);

    // Re-check status in DB (may have been cancelled).
    const res = await query('SELECT status FROM push_schedules WHERE id = $1', [id]);
    if (!res.rows.length) return;
    if (res.rows[0].status !== 'scheduled') return;

    await sendScheduledPush({ query, id, clientId, payload });

    // If the intended delay exceeded MAX_DELAY, reschedule until fireAt.
    if (delay > MAX_DELAY) {
      const res2 = await query('SELECT status FROM push_schedules WHERE id = $1', [id]);
      if (res2.rows.length && res2.rows[0].status === 'scheduled') {
        scheduleTimeout({ query, id, clientId, fireAt, payload });
      }
    }
  }, safeDelay);

  timersById.set(id, handle);
}

export async function upsertPushSubscription({ query, clientId, subscription }) {
  const ts = nowMs();
  await query(
    `INSERT INTO push_subscriptions (client_id, subscription, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (client_id)
     DO UPDATE SET subscription = EXCLUDED.subscription, updated_at = EXCLUDED.updated_at`,
    [clientId, subscription, ts]
  );
}

export async function schedulePushNotification({ query, clientId, fireAtMs, payload }) {
  const id = makeId();
  const ts = nowMs();

  await query(
    `INSERT INTO push_schedules (id, client_id, fire_at, payload, status, created_at)
     VALUES ($1, $2, $3, $4, 'scheduled', $5)`,
    [id, clientId, fireAtMs, payload, ts]
  );

  scheduleTimeout({ query, id, clientId, fireAt: fireAtMs, payload });
  return id;
}

export async function cancelScheduledPush({ query, id }) {
  const ts = nowMs();

  // Clear any in-memory timeout.
  const handle = timersById.get(id);
  if (handle) {
    clearTimeout(handle);
    timersById.delete(id);
  }

  await query(
    "UPDATE push_schedules SET status = 'cancelled', cancelled_at = $1 WHERE id = $2 AND status = 'scheduled'",
    [ts, id]
  );
}

export async function initPushScheduler({ query }) {
  if (!isPushConfigured()) {
    console.warn('⚠ Web Push not configured (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY). Background timer alerts disabled.');
    return;
  }

  // Re-schedule any future notifications that were pending.
  const now = nowMs();
  const res = await query(
    "SELECT id, client_id, fire_at, payload FROM push_schedules WHERE status = 'scheduled' AND fire_at > $1",
    [now]
  );

  for (const row of res.rows) {
    scheduleTimeout({
      query,
      id: row.id,
      clientId: row.client_id,
      fireAt: Number(row.fire_at),
      payload: row.payload
    });
  }

  console.log(`✓ Web Push scheduler initialized (${res.rows.length} pending notifications)`);
}
