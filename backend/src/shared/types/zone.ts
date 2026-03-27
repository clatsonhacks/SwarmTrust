export type ZoneId = 'INTAKE' | 'STORAGE' | 'PROCESSING' | 'PACKAGING' | 'DISPATCH';

export interface ZoneLock {
  zoneId: ZoneId;
  heldBy: string;    // robotId
  expiresInMs: number;
}