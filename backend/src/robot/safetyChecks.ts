import type { Redis } from 'ioredis';
import type { AgentLogger } from './agentLog.js';
import type { SubTask } from './decomposer.js';
import { acquireZoneLock } from '../shared/redis/zoneLock.js';
import { getZoneContents } from '../shared/redis/zoneState.js';
import type { ZoneId } from '../shared/types/index.js';

export type SafetyResult =
  | { ok: true; lockAcquired: boolean }
  | { ok: false; checkType: string; reason: string; retryable: boolean };

/**
 * Run pre-condition safety checks before an irreversible subtask.
 *
 * Checks (in order):
 *   1. Task-level subtask lock — prevents double execution if this subtask
 *      was already picked up by another robot (SET NX EX 60)
 *   2. Zone occupancy — destination zone must be empty (palletId === null)
 *   3. Zone lock — acquire a mutex on the destination zone
 *   4. Robot position — warn if robot is far from source zone (non-blocking)
 */
export async function runSafetyChecks(
  redis: Redis,
  agentLog: AgentLogger,
  subtask: SubTask,
  taskId: string,
  robotId: string,
  destinationZone: ZoneId | null,
  robotCurrentZone: string | null,
  delegated = false,
): Promise<SafetyResult> {
  // ── Check 1: subtask-level deduplication lock ──────────────────────────────
  const subtaskLockKey = `subtask:${taskId}:${subtask.subTaskId}:lock`;
  const subtaskLock = await redis.set(subtaskLockKey, robotId, 'EX', 60, 'NX');

  if (subtaskLock !== 'OK') {
    const reason = 'subtask already claimed by another robot';
    agentLog.append('SAFETY_CHECK', {
      checkType: 'subtask_lock',
      subtaskId: subtask.subTaskId,
      passed: false,
      reason,
      retryable: false,
    });
    return { ok: false, checkType: 'subtask_lock', reason, retryable: false };
  }

  agentLog.append('SAFETY_CHECK', {
    checkType: 'subtask_lock',
    subtaskId: subtask.subTaskId,
    passed: true,
  });

  // ── Check 2: zone occupancy ────────────────────────────────────────────────
  if (destinationZone !== null) {
    const contents = await getZoneContents(redis, destinationZone);
    if (contents.palletId !== null) {
      const reason = `destination zone ${destinationZone} occupied by pallet ${contents.palletId}`;
      agentLog.append('SAFETY_CHECK', {
        checkType: 'zone_occupancy',
        zone: destinationZone,
        palletId: contents.palletId,
        passed: false,
        reason,
        retryable: true,
      });
      return { ok: false, checkType: 'zone_occupancy', reason, retryable: true };
    }

    agentLog.append('SAFETY_CHECK', {
      checkType: 'zone_occupancy',
      zone: destinationZone,
      passed: true,
    });

    // ── Check 3: zone lock ───────────────────────────────────────────────────
    const lockAcquired = await acquireZoneLock(redis, destinationZone, robotId, delegated);
    if (!lockAcquired) {
      const reason = `zone ${destinationZone} is locked by another robot`;
      agentLog.append('SAFETY_CHECK', {
        checkType: 'zone_lock',
        zone: destinationZone,
        passed: false,
        reason,
        retryable: true,
      });
      return { ok: false, checkType: 'zone_lock', reason, retryable: true };
    }

    agentLog.append('SAFETY_CHECK', {
      checkType: 'zone_lock',
      zone: destinationZone,
      passed: true,
      delegated,
    });

    // ── Check 4: robot position (warning only) ───────────────────────────────
    if (robotCurrentZone && robotCurrentZone !== destinationZone) {
      agentLog.append('SAFETY_CHECK', {
        checkType: 'robot_position',
        currentZone: robotCurrentZone,
        destinationZone,
        passed: true,
        warning: 'robot not adjacent to destination zone — navigation required',
      });
    }

    return { ok: true, lockAcquired: true };
  }

  return { ok: true, lockAcquired: false };
}
