import type { Redis } from 'ioredis';
import type { ZoneId } from '../types/index.js';

const LOCK_TTL_SECS = 10;

function lockKey(zoneId: ZoneId): string {
  return `zone:${zoneId}:lock`;
}

// Returns true if lock was acquired, false if zone is already locked
export async function acquireZoneLock(redis: Redis, zoneId: ZoneId, robotId: string): Promise<boolean> {
  const result = await redis.set(lockKey(zoneId), robotId, 'EX', LOCK_TTL_SECS, 'NX');
  return result === 'OK';
}

export async function releaseZoneLock(redis: Redis, zoneId: ZoneId): Promise<void> {
  await redis.del(lockKey(zoneId));
}

export async function getZoneLockHolder(redis: Redis, zoneId: ZoneId): Promise<string | null> {
  return redis.get(lockKey(zoneId));
}