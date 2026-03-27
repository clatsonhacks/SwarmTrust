import type { Redis } from 'ioredis';
import type { ZoneId } from '../types/index.js';

const LOCK_TTL_SELF_SECS = 10;
const LOCK_TTL_DELEGATED_SECS = 60;

function lockKey(zoneId: ZoneId): string {
  return `zone:${zoneId}:lock`;
}

// Returns true if lock was acquired, false if zone is already locked
// delegated=true uses a longer TTL to account for network round-trip to peer
export async function acquireZoneLock(redis: Redis, zoneId: ZoneId, robotId: string, delegated = false): Promise<boolean> {
  const ttl = delegated ? LOCK_TTL_DELEGATED_SECS : LOCK_TTL_SELF_SECS;
  const result = await redis.set(lockKey(zoneId), robotId, 'EX', ttl, 'NX');
  return result === 'OK';
}

export async function releaseZoneLock(redis: Redis, zoneId: ZoneId): Promise<void> {
  await redis.del(lockKey(zoneId));
}

export async function getZoneLockHolder(redis: Redis, zoneId: ZoneId): Promise<string | null> {
  return redis.get(lockKey(zoneId));
}