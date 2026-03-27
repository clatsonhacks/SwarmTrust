import type { Task, Zone } from '../shared/types/index.js';

function makeTask(
  id: number,
  description: string,
  sourceZone: Zone,
  destinationZone: Zone,
  priority: Task['priority']
): Task {
  return {
    taskId: `task-${String(id).padStart(3, '0')}`,
    description,
    sourceZone,
    destinationZone,
    priority,
    createdAt: Date.now(),
  };
}

export const initialTasks: Task[] = [
  // SCOUT tasks — area scanning and inventory
  makeTask(1, 'Scan all shelves in STORAGE and report inventory', 'STORAGE', 'STORAGE', 'normal'),
  makeTask(2, 'Inspect INTAKE zone for newly arrived pallets', 'INTAKE', 'INTAKE', 'high'),

  // LIFTER tasks — heavy pallet movement
  makeTask(3, 'Move pallet from INTAKE to STORAGE', 'INTAKE', 'STORAGE', 'high'),
  makeTask(4, 'Move pallet from STORAGE to PROCESSING', 'STORAGE', 'PROCESSING', 'normal'),

  // CARRIER tasks — box transport
  makeTask(5, 'Transport three boxes from STORAGE to DISPATCH', 'STORAGE', 'DISPATCH', 'urgent'),
  makeTask(6, 'Carry processed goods from PROCESSING to PACKAGING', 'PROCESSING', 'PACKAGING', 'normal'),

  // INSPECTOR tasks — quality checks
  makeTask(7, 'Inspect and tag all items in PACKAGING before dispatch', 'PACKAGING', 'DISPATCH', 'high'),

  // Multi-capability tasks — forces peer delegation
  makeTask(8, 'Scout INTAKE then coordinate lifter to move flagged pallet to STORAGE', 'INTAKE', 'STORAGE', 'urgent'),
  makeTask(9, 'Inspect PROCESSING output and carry approved items to PACKAGING', 'PROCESSING', 'PACKAGING', 'normal'),
  makeTask(10, 'Full dispatch run: scan STORAGE, lift pallet, carry boxes to DISPATCH', 'STORAGE', 'DISPATCH', 'low'),
];