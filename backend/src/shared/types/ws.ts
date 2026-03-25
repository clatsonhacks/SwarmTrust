import type { RobotId, RobotBehaviorState, RobotPosition } from './robot.js';
import type { SessionStats } from './stats.js';

export type WsMessageType =
  | 'ROBOT_POSITION_UPDATE'
  | 'ROBOT_STATE_CHANGE'
  | 'PAYMENT_EVENT'
  | 'REPUTATION_UPDATE'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETE'
  | 'LOG_ENTRY'
  | 'SESSION_STATS';

export interface WsRobotPositionUpdate {
  type: 'ROBOT_POSITION_UPDATE';
  robotId: RobotId;
  position: RobotPosition;
  timestamp: number;
}

export interface WsRobotStateChange {
  type: 'ROBOT_STATE_CHANGE';
  robotId: RobotId;
  state: RobotBehaviorState;
  taskId: string | null;
  timestamp: number;
}

export interface WsPaymentEvent {
  type: 'PAYMENT_EVENT';
  from: RobotId;
  to: RobotId;
  amountUsdc: string;
  txHash: string;
  timestamp: number;
}

export interface WsReputationUpdate {
  type: 'REPUTATION_UPDATE';
  robotId: RobotId;
  oldScore: number;
  newScore: number;
  reason: string;
  timestamp: number;
}

export interface WsTaskAssigned {
  type: 'TASK_ASSIGNED';
  taskId: string;
  robotId: RobotId;
  description: string;
  timestamp: number;
}

export interface WsTaskComplete {
  type: 'TASK_COMPLETE';
  taskId: string;
  robotId: RobotId;
  timestamp: number;
}

export interface WsLogEntry {
  type: 'LOG_ENTRY';
  robotId: RobotId | 'orchestrator';
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

export interface WsSessionStats {
  type: 'SESSION_STATS';
  stats: SessionStats;
  timestamp: number;
}

export type WsMessage =
  | WsRobotPositionUpdate
  | WsRobotStateChange
  | WsPaymentEvent
  | WsReputationUpdate
  | WsTaskAssigned
  | WsTaskComplete
  | WsLogEntry
  | WsSessionStats;