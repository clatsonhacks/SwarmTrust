export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Zone =
  | 'INTAKE'
  | 'STORAGE'
  | 'PROCESSING'
  | 'PACKAGING'
  | 'DISPATCH';

export interface Task {
  taskId: string;          // e.g. "task-001"
  description: string;    // e.g. "Move pallet from INTAKE to STORAGE"
  sourceZone: Zone;
  destinationZone: Zone;
  priority: TaskPriority;
  createdAt: number;       // Unix timestamp (ms)
}