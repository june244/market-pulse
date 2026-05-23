import { Redis } from '@upstash/redis';

type StoredValue = {
  value: unknown;
  expiresAt: number | null;
};

const memory = new Map<string, StoredValue>();

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function isExpired(entry: StoredValue): boolean {
  return entry.expiresAt != null && entry.expiresAt <= Date.now();
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export function isPersistentStoreConfigured(): boolean {
  return getRedis() != null;
}

export async function storeGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (client) {
    return await client.get<T>(key);
  }

  const entry = memory.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    memory.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function storeSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const client = getRedis();
  if (client) {
    if (ttlSeconds) {
      await client.set(key, value, { ex: ttlSeconds });
    } else {
      await client.set(key, value);
    }
    return;
  }

  memory.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

export async function storeDel(key: string): Promise<void> {
  const client = getRedis();
  if (client) {
    await client.del(key);
    return;
  }
  memory.delete(key);
}

export async function storeKeys(pattern: string): Promise<string[]> {
  const client = getRedis();
  if (client) {
    return await client.keys(pattern);
  }

  const re = globToRegExp(pattern);
  const keys: string[] = [];
  for (const [key, entry] of Array.from(memory.entries())) {
    if (isExpired(entry)) {
      memory.delete(key);
      continue;
    }
    if (re.test(key)) keys.push(key);
  }
  return keys;
}
