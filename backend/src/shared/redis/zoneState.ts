import type { Redis } from 'ioredis';

export interface ZoneContents {
  palletId: string | null;
  itemCount: number;
  lastUpdated: number;
}

const EMPTY_ZONE: ZoneContents = { palletId: null, itemCount: 0, lastUpdated: 0 };

export async function getZoneContents(redis: Redis, zone: string): Promise<ZoneContents> {
  const raw = await redis.get(`zone:${zone}:contents`);
  if (!raw) return { ...EMPTY_ZONE };
  try {
    return JSON.parse(raw) as ZoneContents;
  } catch {
    return { ...EMPTY_ZONE };
  }
}

// Atomically read-then-write zone contents using a Lua script to prevent
// race conditions when two robots update the same zone simultaneously.
export async function setZoneContents(redis: Redis, zone: string, contents: ZoneContents): Promise<void> {
  await redis.set(
    `zone:${zone}:contents`,
    JSON.stringify({ ...contents, lastUpdated: Date.now() })
  );
}

export async function clearZoneContents(redis: Redis, zone: string): Promise<void> {
  await redis.set(
    `zone:${zone}:contents`,
    JSON.stringify({ palletId: null, itemCount: 0, lastUpdated: Date.now() })
  );
}