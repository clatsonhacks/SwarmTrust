// Widened to string to support dynamically spawned robots.
// Static robot IDs are preserved in STATIC_ROBOT_IDS for orchestrator startup.
export type RobotId = string;

export const STATIC_ROBOT_IDS: RobotId[] = [
  'scout-1',
  'lifter-2',
  'scout-3',
  'carrier-4',
  'lifter-5',
];

export type RobotBehaviorState =
  | 'IDLE'
  | 'MOVING'
  | 'EXECUTING'
  | 'WAITING'
  | 'WAITING_PAYMENT';

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
}

export type RobotCapability = 'NAVIGATE' | 'SCAN' | 'LIFT' | 'CARRY';

export interface RobotState {
  robotId: RobotId;
  position: RobotPosition;
  currentTaskId: string | null;
  behaviorState: RobotBehaviorState;
  reputationScore: number;
  usdcBalance: string;        // stored as string to avoid float precision issues
  lastUpdated: number;        // Unix timestamp (ms)
  capabilities: RobotCapability[];  // robot capabilities from manifest
}