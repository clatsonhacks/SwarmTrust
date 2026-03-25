export type RobotId =
  | 'scout-1'
  | 'lifter-2'
  | 'scout-3'
  | 'carrier-4'
  | 'lifter-5';

export type RobotBehaviorState =
  | 'IDLE'
  | 'MOVING'
  | 'EXECUTING'
  | 'WAITING_PAYMENT';

export interface RobotPosition {
  x: number;
  y: number;
  z: number;
}

export interface RobotState {
  robotId: RobotId;
  position: RobotPosition;
  currentTaskId: string | null;
  behaviorState: RobotBehaviorState;
  reputationScore: number;
  usdcBalance: string;        // stored as string to avoid float precision issues
  lastUpdated: number;        // Unix timestamp (ms)
}