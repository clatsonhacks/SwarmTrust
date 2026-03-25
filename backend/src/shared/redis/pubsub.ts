import type Redis from 'ioredis';
import type { RobotId, RobotEvent } from '../types/index.js';

function eventChannel(robotId: RobotId): string {
  return `robot:${robotId}:events`;
}

export async function publishEvent(redis: Redis, event: RobotEvent): Promise<void> {
  await redis.publish(eventChannel(event.robotId), JSON.stringify(event));
}

// Subscribes to all robot event channels using pattern: robot:*:events
// Pass a separate Redis client (subscriber connection cannot issue regular commands)
export function subscribeToAllRobotEvents(
  subscriberClient: Redis,
  onEvent: (robotId: string, event: RobotEvent) => void
): void {
  subscriberClient.psubscribe('robot:*:events');

  subscriberClient.on('pmessage', (_pattern, channel, message) => {
    const robotId = channel.split(':')[1];
    const event = JSON.parse(message) as RobotEvent;
    onEvent(robotId, event);
  });
}