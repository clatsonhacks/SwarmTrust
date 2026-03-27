import type { Redis } from 'ioredis';
import { acquireZoneLock } from '../shared/redis/zoneLock.js';
import { getZoneContents } from '../shared/redis/zoneState.js';
import type { AgentLogger } from './agentLog.js';
import type { SubTask } from './decomposer.js';
import type { ZoneId } from '../shared/types/index.js';

export type SafetyResult =
  | { ok: true; lockAcquired: boolean }
  | { ok: false; checkType: string; reason: string; retryable: boolean };

/**
 * Run all pre-condition safety checks before executing an irreversible subtask.
 *
 * Checks performed in order:
 *  1. Task-level subtask lock — prevents duplicate execution if two paths
 *     converge on the same sub-task (SET NX, 60s TTL).
 *  2. Zone occupancy — destination must not already hold a pallet.
 *  3. Zone lock — SET NX EX 10 on the destination zone (crash-safe via TTL).
 *  4. Robot position — warning-only; simulation precision is coarse.
 *
 * Returns { ok: true, lockAcquired } on success, or
 *         { ok: false, checkType, reason, retryable } on failure.
 */
export async function runSafetyChecks(
  redis: Redis,
  agentLog: AgentLogger,
  subtask: SubTask,
  taskId: string,
  robotId: string,
  destinationZone: string | undefined,
  robotCurrentZone: string | undefined,
  delegated = false,
): Promise<SafetyResult> {

  // ── 1. Task-level subtask lock ──────────────────────────────────────────────
  const taskLockKey = `task:${taskId}:${subtask.subTaskId}:lock`;
  const claimed = await redis.set(taskLockKey, robotId, 'EX', 60, 'NX');
  if (claimed !== 'OK') {
    const reason = 'Another robot already claimed this sub-task execution';
    agentLog.append('SAFETY_CHECK', {
      subTaskId: subtask.subTaskId,
      checkType: 'task_lock',
      result: 'failed',
      reason,
    });
    return { ok: false, checkType: 'task_lock', reason, retryable: false };
  }

  if (destinationZone) {
    // ── 2. Zone occupancy check ─────────────────────────────────────────────
    const contents = await getZoneContents(redis, destinationZone);
    if (contents.palletId !== null) {
      const reason = `Zone ${destinationZone} is occupied by pallet ${contents.palletId}`;
      agentLog.append('SAFETY_CHECK', {
        subTaskId: subtask.subTaskId,
        checkType: 'zone_occupancy',
        zone: destinationZone,
        result: 'failed',
        reason,
      });
      // Release the task lock so a retry can re-claim it
      await redis.del(taskLockKey);
      return { ok: false, checkType: 'zone_occupancy', reason, retryable: true };
    }

    // ── 3. Zone lock ────────────────────────────────────────────────────────
    const locked = await acquireZoneLock(redis, destinationZone as ZoneId, robotId, delegated);
    if (!locked) {
      const reason = `Zone ${destinationZone} lock is held by another robot`;
      agentLog.append('SAFETY_CHECK', {
        subTaskId: subtask.subTaskId,
        checkType: 'zone_lock',
        zone: destinationZone,
        result: 'failed',
        reason,
      });
      await redis.del(taskLockKey);
      return { ok: false, checkType: 'zone_lock', reason, retryable: true };
    }
  }

  // ── 4. Robot position (advisory warning, does not block) ───────────────────
  if (robotCurrentZone && destinationZone && robotCurrentZone !== destinationZone) {
    agentLog.append('SAFETY_CHECK', {
      subTaskId: subtask.subTaskId,
      checkType: 'position',
      result: 'warning',
      reason: `Robot is at ${robotCurrentZone} but action targets ${destinationZone} — continuing`,
    });
  }

  // All checks passed
  agentLog.append('SAFETY_CHECK', {
    subTaskId: subtask.subTaskId,
    checkType: 'all',
    zone: destinationZone ?? 'n/a',
    result: 'passed',
  });

  return { ok: true, lockAcquired: !!destinationZone };
}