import type { Redis } from 'ioredis';
import type { Task } from '../types/index.js';

const QUEUE_KEY = 'tasks:queue';

export async function pushTask(redis: Redis, task: Task): Promise<void> {
  await redis.rpush(QUEUE_KEY, JSON.stringify(task));
}

export async function popTask(redis: Redis, timeoutSecs = 30): Promise<Task | null> {
  const result = await redis.blpop(QUEUE_KEY, timeoutSecs);
  if (!result) return null;
  return JSON.parse(result[1]) as Task;
}

export async function queueLength(redis: Redis): Promise<number> {
  return redis.llen(QUEUE_KEY);
}