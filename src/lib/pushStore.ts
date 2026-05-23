/**
 * In-memory web push subscription store.
 * Subscriptions are lost on cold start / redeploy — clients re-subscribe on app open.
 */

import webpush, { PushSubscription, WebPushError } from 'web-push';
import { storeDel, storeGet, storeKeys, storeSet } from './persistentStore';

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

const subs = new Map<string, StoredSubscription>();
let vapidConfigured = false;
const KEY_PREFIX = 'push:subscription';

function keyFor(endpoint: string): string {
  return `${KEY_PREFIX}:${encodeURIComponent(endpoint)}`;
}

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

export async function addSubscription(sub: PushSubscription): Promise<void> {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return;
  const stored = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    createdAt: new Date().toISOString(),
  };
  subs.set(sub.endpoint, stored);
  await storeSet(keyFor(sub.endpoint), stored);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  subs.delete(endpoint);
  await storeDel(keyFor(endpoint));
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const keys = await storeKeys(`${KEY_PREFIX}:*`);
  const persisted = await Promise.all(keys.map((key) => storeGet<StoredSubscription>(key)));
  for (const sub of persisted) {
    if (sub?.endpoint) subs.set(sub.endpoint, sub);
  }
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

  const all = await listSubscriptions();
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
          await removeSubscription(s.endpoint);
          removed++;
        }
      }
    }),
  );

  return { sent, removed };
}
