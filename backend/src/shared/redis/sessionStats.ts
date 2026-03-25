import type Redis from 'ioredis';
import type { SessionStats } from '../types/index.js';

const STATS_KEY = 'session:stats';

export async function incrementStat(
  redis: Redis,
  field: keyof SessionStats,
  by = 1
): Promise<void> {
  await redis.hincrby(STATS_KEY, field, by);
}

export async function getSessionStats(redis: Redis): Promise<SessionStats> {
  const data = await redis.hgetall(STATS_KEY);
  return {
    tasksCompleted: parseInt(data.tasksCompleted ?? '0'),
    totalUsdcTransferred: data.totalUsdcTransferred ?? '0',
    onChainTransactionCount: parseInt(data.onChainTransactionCount ?? '0'),
    reputationUpdatesWritten: parseInt(data.reputationUpdatesWritten ?? '0'),
  };
}

export async function resetSessionStats(redis: Redis): Promise<void> {
  await redis.del(STATS_KEY);
}