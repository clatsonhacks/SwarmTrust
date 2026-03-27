import type { Redis } from 'ioredis';
import type { RobotId, RobotState } from '../types/index.js';

function stateKey(robotId: RobotId): string {
  return `robot:${robotId}:state`;
}

export async function setRobotState(redis: Redis, state: RobotState): Promise<void> {
  const key = stateKey(state.robotId);
  await redis.hset(key, {
    robotId: state.robotId,
    positionX: state.position.x,
    positionY: state.position.y,
    positionZ: state.position.z,
    currentTaskId: state.currentTaskId ?? '',
    behaviorState: state.behaviorState,
    reputationScore: state.reputationScore,
    usdcBalance: state.usdcBalance,
    lastUpdated: state.lastUpdated,
  });
}

export async function getRobotState(redis: Redis, robotId: RobotId): Promise<RobotState | null> {
  const key = stateKey(robotId);
  const data = await redis.hgetall(key);
  if (!data || !data.robotId) return null;

  return {
    robotId: data.robotId as RobotId,
    position: {
      x: parseFloat(data.positionX ?? '0'),
      y: parseFloat(data.positionY ?? '0'),
      z: parseFloat(data.positionZ ?? '0'),
    },
    currentTaskId: data.currentTaskId || null,
    behaviorState: (data.behaviorState ?? 'IDLE') as RobotState['behaviorState'],
    reputationScore: parseFloat(data.reputationScore ?? '0'),
    usdcBalance: data.usdcBalance ?? '0',
    lastUpdated: parseInt(data.lastUpdated ?? '0'),
  };
}