export type ZoneId = 'INTAKE' | 'STORAGE' | 'STAGING' | 'DISPATCH';

export interface ZoneLock {
  zoneId: ZoneId;
  heldBy: string;    // robotId
  expiresInMs: number;
}