import type { Redis } from 'ioredis';
import type { ZoneId } from '../types/index.js';

/** Default TTL for self-executed actions (crash safety net). */
const LOCK_TTL_SECS = 10;
/** Extended TTL for delegated actions — covers x402 round-trip + peer execution. */
const LOCK_TTL_DELEGATED_SECS = 60;

function lockKey(zoneId: ZoneId): string {
  return `zone:${zoneId}:lock`;
}

// Returns true if lock was acquired, false if zone is already locked
export async function acquireZoneLock(
  redis: Redis,
  zoneId: ZoneId,
  robotId: string,
  delegated = false,
): Promise<boolean> {
  const ttl = delegated ? LOCK_TTL_DELEGATED_SECS : LOCK_TTL_SECS;
  const result = await redis.set(lockKey(zoneId), robotId, 'EX', ttl, 'NX');
  return result === 'OK';
}

export async function releaseZoneLock(redis: Redis, zoneId: ZoneId): Promise<void> {
  await redis.del(lockKey(zoneId));
}

export async function getZoneLockHolder(redis: Redis, zoneId: ZoneId): Promise<string | null> {
  return redis.get(lockKey(zoneId));
}