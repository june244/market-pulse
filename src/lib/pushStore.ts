/**
 * In-memory web push subscription store.
 * Subscriptions are lost on cold start / redeploy — clients re-subscribe on app open.
 */

import webpush, { PushSubscription, WebPushError } from 'web-push';

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

const subs = new Map<string, StoredSubscription>();
let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@market-pulse.local';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export function addSubscription(sub: PushSubscription): void {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
  subs.set(sub.endpoint, {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    createdAt: new Date().toISOString(),
  });
}

export function removeSubscription(endpoint: string): void {
  subs.delete(endpoint);
}

export function listSubscriptions(): StoredSubscription[] {
  return Array.from(subs.values());
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  severity?: 'HIGH' | 'MED' | 'LOW';
}

export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    throw new Error('VAPID keys not configured');
  }
  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  const all = Array.from(subs.values());
  await Promise.all(
    all.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          body,
        );
        sent++;
      } catch (e) {
        const err = e as WebPushError;
        if (err.statusCode === 404 || err.statusCode === 410) {
          subs.delete(s.endpoint);
          removed++;
        }
      }
    }),
  );

  return { sent, removed };
}
