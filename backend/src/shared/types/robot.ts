export type RobotId =
  | 'scout-1'
  | 'lifter-2'
  | 'carrier-3'
  | 'inspector-4'
  | 'dispatcher-5';

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