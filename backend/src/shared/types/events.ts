import type { RobotId, RobotBehaviorState } from './robot.js';

export type RobotEventType =
  | 'STATE_CHANGED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'ZONE_LOCKED'
  | 'ZONE_RELEASED'
  | 'PAYMENT_SENT'
  | 'REPUTATION_UPDATED'
  | 'ERROR';

export interface RobotEvent {
  robotId: RobotId;
  type: RobotEventType;
  state: RobotBehaviorState;
  taskId?: string;
  zoneId?: string;
  payload?: Record<string, unknown>;
  timestamp: number;          // Unix timestamp (ms)
}