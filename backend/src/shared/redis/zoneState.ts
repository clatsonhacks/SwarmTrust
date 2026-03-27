import type { Redis } from 'ioredis';

export interface ZoneContents {
  palletId: string | null;
  itemCount: number;
  lastUpdated: number;
}

function contentsKey(zone: string): string {
  return `zone:${zone}:contents`;
}

export async function getZoneContents(redis: Redis, zone: string): Promise<ZoneContents> {
  const raw = await redis.get(contentsKey(zone));
  if (!raw) return { palletId: null, itemCount: 0, lastUpdated: 0 };
  return JSON.parse(raw) as ZoneContents;
}

export async function setZoneContents(redis: Redis, zone: string, contents: ZoneContents): Promise<void> {
  await redis.set(contentsKey(zone), JSON.stringify(contents));
}

export async function clearZoneContents(redis: Redis, zone: string): Promise<void> {
  await redis.set(contentsKey(zone), JSON.stringify({ palletId: null, itemCount: 0, lastUpdated: Date.now() }));
}
