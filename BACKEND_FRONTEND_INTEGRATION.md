# Backend-Frontend Integration Guide

## Overview

The SwarmTrust frontend is now fully integrated with the backend orchestrator and robot agent system. This document explains how the integration works and how to use the new features.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Task Manager │  │Agent Inventory│  │Communication Log│  │
│  │     UI       │  │      UI       │  │       UI        │  │
│  └──────┬───────┘  └──────┬────────┘  └────────┬────────┘  │
│         │                  │                     │           │
│         └──────────────────┼─────────────────────┘           │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐ │
│  │              useBackendApi (REST)                       │ │
│  │  • createTask()                                         │ │
│  │  • spawnAgent()                                         │ │
│  │  • fetchAllAgents()                                     │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐ │
│  │           useBackendSocket (WebSocket)                  │ │
│  │  • ROBOT_POSITION_UPDATE                                │ │
│  │  • ROBOT_STATE_CHANGE                                   │ │
│  │  • TASK_ASSIGNED / TASK_COMPLETE                        │ │
│  │  • PAYMENT_EVENT / REPUTATION_UPDATE                    │ │
│  │  • ROBOT_SPAWNED                                        │ │
│  │  • SESSION_STATS                                        │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            │                                 │
│  ┌─────────────────────────▼──────────────────────────────┐ │
│  │              agentStore (Zustand)                       │ │
│  │  • agents (3D simulation)                               │ │
│  │  • tasks (task queue)                                   │ │
│  │  • agentInventory (backend robots)                      │ │
│  │  • activeComms (visual communications)                  │ │
│  │  • log (event log)                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    HTTP + WebSocket
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                  BACKEND (Express.js)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Orchestrator                            │   │
│  │  • WebSocket Server (port 8080)                      │   │
│  │  • REST API (port 3000)                              │   │
│  │  • Task Generator                                    │   │
│  │  • Stats Broadcaster                                 │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │                                      │
│                   REDIS (Pub/Sub)                            │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │          Robot Agents (Ports 3001-3005+)             │   │
│  │  • Decision Loop (task execution)                    │   │
│  │  • Task Decomposition (Groq LLM)                     │   │
│  │  • Peer Delegation (x402 payments)                   │   │
│  │  • Blockchain Integration (Base Sepolia)             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Features

### 1. Task Management System

**Location**: Top-right button (📋 icon)

**Features**:
- Create new tasks with description, source/destination zones, and priority
- Optionally assign tasks to specific agents
- View active tasks with real-time status updates
- Task statuses: `pending` → `executing` → `completed`

**Usage**:
```typescript
// Task creation flow:
1. Click Task Manager button (📋)
2. Fill in task details:
   - Description: "Move pallet from INTAKE to STORAGE"
   - Source Zone: INTAKE
   - Destination Zone: STORAGE
   - Priority: normal/high/urgent
   - Assign to Agent: (optional)
3. Click "CREATE TASK"
4. Task is added to backend queue via REST API
5. Backend assigns task to available robot
6. Frontend receives TASK_ASSIGNED event via WebSocket
7. Task status updates to "executing"
8. Frontend receives TASK_COMPLETE event
9. Task status updates to "completed"
```

**API Integration**:
```typescript
// REST API call
POST http://localhost:3000/api/task
{
  "description": "Move pallet from INTAKE to STORAGE",
  "sourceZone": "INTAKE",
  "destinationZone": "STORAGE",
  "priority": "normal",
  "assignedTo": "robot-1" // optional
}
```

### 2. Agent Inventory System

**Location**: Second button from top-right (🤖 icon)

**Features**:
- View all active robot agents with their capabilities
- Real-time agent status (IDLE, MOVING, EXECUTING, etc.)
- Agent details: position, reputation, USDC balance, current task
- Spawn new agents with custom capabilities
- Grid view with detailed side panel

**Usage**:
```typescript
// View agents:
1. Click Agent Inventory button (🤖)
2. Browse agent cards showing:
   - Robot ID (e.g., scout-1, lifter-2)
   - Capabilities (NAVIGATE, SCAN, LIFT, CARRY)
   - Current status and reputation score
   - USDC balance
3. Click an agent card to view full details

// Spawn new agent:
1. Click "+ SPAWN AGENT" button
2. Select capabilities (multiple allowed):
   - NAVIGATE (movement between zones)
   - SCAN (inventory inspection)
   - LIFT (heavy pallet operations)
   - CARRY (box transport)
3. Click "Spawn Agent"
4. Backend creates new robot with wallet and on-chain identity
5. Agent appears in inventory after ~10-20 seconds
6. Frontend receives ROBOT_SPAWNED event
```

**API Integration**:
```typescript
// Spawn agent
POST http://localhost:3000/api/spawn-robot
{
  "capabilities": ["NAVIGATE", "SCAN"],
  "name": "optional-name" // optional
}

// Response
{
  "robotId": "dynamic-navigate-scan-abc123",
  "capabilities": ["NAVIGATE", "SCAN"],
  "walletAddress": "0x...",
  "endpoint": "http://localhost:3006",
  "message": "Robot spawned successfully"
}
```

### 3. Real-Time Communication Log

**Location**: Bottom-right (transparent panel)

**Features**:
- YouTube-style live comment feed
- Shows agent-to-agent communications
- Task delegations via x402 payments
- Peer selection and capability requests
- Circular agent avatars with color coding

**Backend Events**:
The communication log displays real backend events when connected:
- **PEER_DELEGATION**: Agent A delegates subtask to Agent B
- **PAYMENT_SENT**: x402 USDC payment for task delegation
- **TASK_ASSIGNED**: Task assigned to robot
- **STATE_CHANGED**: Robot state transitions

**Data Flow**:
```typescript
Backend Robot → Redis Pub/Sub → Orchestrator WS → Frontend → Communication Log

Example:
1. Robot "scout-1" needs LIFT capability
2. Finds peer "lifter-2" with good reputation
3. Delegates subtask via x402 payment (0.01 USDC)
4. Backend publishes PEER_DELEGATION event
5. Frontend receives event via WebSocket
6. Communication log shows: "scout-1 → lifter-2 · LIFT"
```

### 4. WebSocket Event Handling

**Connection**: `ws://localhost:8080`

**Events Handled**:

#### ROBOT_POSITION_UPDATE
```typescript
{
  type: 'ROBOT_POSITION_UPDATE',
  robotId: 'scout-1',
  position: { x: 10.5, y: 0, z: 15.2 }
}
```
Updates agent position in 3D scene and inventory.

#### ROBOT_STATE_CHANGE
```typescript
{
  type: 'ROBOT_STATE_CHANGE',
  robotId: 'scout-1',
  state: 'EXECUTING',
  taskId: 'task-001'
}
```
Updates agent behavior state and current task.

#### TASK_ASSIGNED
```typescript
{
  type: 'TASK_ASSIGNED',
  robotId: 'scout-1',
  taskId: 'task-001'
}
```
Marks task as "executing" in task manager.

#### TASK_COMPLETE
```typescript
{
  type: 'TASK_COMPLETE',
  robotId: 'scout-1',
  taskId: 'task-001'
}
```
Marks task as "completed", resets agent to IDLE.

#### PAYMENT_SENT
```typescript
{
  type: 'PAYMENT_SENT',
  robotId: 'scout-1',
  payload: {
    to: 'lifter-2',
    amountUsdc: '0.01',
    txHash: '0x...'
  }
}
```
Shows payment beam in 3D scene, adds to communication log.

#### REPUTATION_UPDATED
```typescript
{
  type: 'REPUTATION_UPDATED',
  robotId: 'scout-1',
  payload: {
    from: 'lifter-2',
    delta: 5,
    reason: 'task_success'
  }
}
```
Updates agent reputation score in inventory.

#### ROBOT_SPAWNED
```typescript
{
  type: 'ROBOT_SPAWNED',
  robot: {
    robotId: 'dynamic-navigate-scan-abc',
    capabilities: ['NAVIGATE', 'SCAN'],
    walletAddress: '0x...',
    endpoint: 'http://localhost:3006'
  }
}
```
Adds new agent to inventory with initial state.

#### SESSION_STATS
```typescript
{
  type: 'SESSION_STATS',
  stats: {
    tasksCompleted: 42,
    totalUsdcTransferred: '0.523',
    onChainTransactionCount: 15
  }
}
```
Updates global statistics displayed in UI.

## State Management

### Agent Store Structure

```typescript
interface SimStore {
  // 3D simulation agents (visual representations)
  agents: AgentRuntime[]

  // Backend task queue
  tasks: Task[]

  // Backend robot inventory (real agent data)
  agentInventory: AgentInventoryItem[]

  // Visual communication system
  activeComms: ActiveComm[]

  // Event log
  log: LogEntry[]

  // Session statistics
  tasksDone: number
  totalUSDC: number
  totalTx: number

  // WebSocket connection status
  connected: boolean

  // View state
  currentView: ViewState
}
```

### Data Synchronization

**3D Agents vs Backend Robots**:
- `agents`: Visual 3D representations (R1-R5) for simulation
- `agentInventory`: Real backend robot data (scout-1, lifter-2, etc.)
- When backend is connected, 3D agents sync with backend robot positions
- When backend is disconnected, 3D agents run autonomous simulation

**Task Flow**:
```
User creates task → Frontend addTask() → REST API POST /api/task
                                              ↓
Backend queues task → Redis tasks:queue → Robot BLPOP
                                              ↓
Robot executes → Publishes TASK_ASSIGNED → Frontend receives
                                              ↓
Task completes → Publishes TASK_COMPLETE → Frontend updates status
```

## Environment Variables

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Backend** (`.env`):
```bash
REDIS_URL=redis://localhost:6379
WS_PORT=8080
API_PORT=3000
RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
GROQ_API_KEY=gsk_...
```

## Usage Scenarios

### Scenario 1: Create and Track a Task

```typescript
1. Start backend: cd backend && npm run dev
2. Start frontend: cd frontend && npm run dev
3. Open http://localhost:3000/warehouse
4. Click Task Manager (📋)
5. Create task:
   - Description: "Scan inventory in STORAGE"
   - Source: STORAGE
   - Destination: STAGING
   - Priority: high
6. Click "CREATE TASK"
7. Watch task appear in queue with status "pending"
8. Backend assigns to robot with SCAN capability
9. Task status changes to "executing"
10. Robot completes task
11. Task status changes to "completed"
12. Communication log shows delegation events
```

### Scenario 2: Spawn a New Agent

```typescript
1. Click Agent Inventory (🤖)
2. Click "+ SPAWN AGENT"
3. Select capabilities: [NAVIGATE, CARRY]
4. Click "Spawn Agent"
5. Backend creates new robot with:
   - New wallet funded with ETH + USDC
   - On-chain ERC-8004 registration
   - Capabilities registered on-chain
   - HTTP server on dynamic port (3006+)
6. After ~15 seconds, new agent appears in inventory
7. Agent is ready to accept tasks
8. Can now create CARRY tasks that will be assigned to this agent
```

### Scenario 3: Monitor Agent Communications

```typescript
1. Ensure backend is running
2. Watch Communication Log (bottom-right)
3. Observe real-time agent interactions:
   - "scout-1 → lifter-2 · Task delegation via x402"
   - "lifter-2 → carrier-4 · CARRY capability request"
4. Each entry shows:
   - From/To agents with color-coded avatars
   - Zone routing (e.g., INTAKE → STORAGE)
   - Timestamp
   - Message/action description
5. Log updates automatically as backend events occur
6. Maximum 20 recent entries displayed
```

## Testing the Integration

### Manual Testing Checklist

**Backend Setup**:
- [ ] Redis running (`redis-server`)
- [ ] Backend orchestrator running (`npm run dev` in backend/)
- [ ] Static robots registered (scout-1 through lifter-5)
- [ ] WebSocket server listening on port 8080
- [ ] REST API listening on port 3000

**Frontend Setup**:
- [ ] Frontend running (`npm run dev` in frontend/)
- [ ] WebSocket connected (green "LIVE" indicator)
- [ ] No console errors

**Task Management**:
- [ ] Can open Task Manager panel
- [ ] Can create new task
- [ ] Task appears in backend logs
- [ ] Task status updates from pending → executing → completed
- [ ] Task appears in task list

**Agent Inventory**:
- [ ] Can open Agent Inventory panel
- [ ] Shows all 5 static robots
- [ ] Agent details display correctly
- [ ] Can spawn new agent
- [ ] New agent appears after spawn
- [ ] Agent capabilities displayed correctly

**Communication Log**:
- [ ] Shows in bottom-right
- [ ] Background is transparent
- [ ] Updates with real backend events
- [ ] Shows agent delegations
- [ ] Timestamp format correct

**3D Scene**:
- [ ] Agents move between zones
- [ ] Agent colors match inventory
- [ ] Speech bubbles appear during communication
- [ ] Payment beams visible during x402 transfers

### Automated Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration test (requires both running)
npm run test:integration
```

## Troubleshooting

### WebSocket Not Connecting

**Symptoms**: Red "SIM" indicator, no real-time updates

**Solutions**:
1. Check backend orchestrator is running
2. Verify `NEXT_PUBLIC_WS_URL` in `.env.local`
3. Check browser console for WebSocket errors
4. Ensure port 8080 is not blocked by firewall

### Tasks Not Being Assigned

**Symptoms**: Tasks stuck in "pending" status

**Solutions**:
1. Check Redis connection in backend logs
2. Verify robots are registered: `redis-cli KEYS robot:*:state`
3. Check task queue: `redis-cli LLEN tasks:queue`
4. Ensure robots are in IDLE state

### Agents Not Appearing in Inventory

**Symptoms**: Empty inventory panel

**Solutions**:
1. Check `/api/robots` endpoint: `curl http://localhost:3000/api/robots`
2. Verify Redis has robot states: `redis-cli KEYS robot:*:state`
3. Check browser network tab for 404/500 errors
4. Ensure backend orchestrator has completed initialization

### Spawn Agent Fails

**Symptoms**: Error message, no new agent created

**Solutions**:
1. Check backend has sufficient funds for faucet
2. Verify RPC_URL is correct in `.env`
3. Check Groq API key is valid
4. Review backend logs for spawn errors
5. Ensure Redis is accessible

## API Reference

### REST Endpoints

#### POST /api/task
Create a new task in the queue.

**Request**:
```typescript
{
  description: string
  sourceZone: 'INTAKE' | 'STORAGE' | 'SORTING' | 'STAGING' | 'DISPATCH' | 'CHARGING'
  destinationZone: 'INTAKE' | 'STORAGE' | 'SORTING' | 'STAGING' | 'DISPATCH' | 'CHARGING'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assignedTo?: string
}
```

**Response**: `200 OK` or error

#### POST /api/spawn-robot
Spawn a new robot agent dynamically.

**Request**:
```typescript
{
  capabilities: ('NAVIGATE' | 'SCAN' | 'LIFT' | 'CARRY')[]
  name?: string
}
```

**Response**:
```typescript
{
  robotId: string
  capabilities: string[]
  walletAddress: string
  endpoint: string
  message: string
}
```

#### GET /api/robots
Fetch all registered robot agents.

**Response**:
```typescript
{
  robotId: string
  position: { x: number, y: number, z: number }
  currentTaskId: string | null
  behaviorState: 'IDLE' | 'MOVING' | 'EXECUTING' | 'WAITING' | 'WAITING_PAYMENT'
  reputationScore: number
  usdcBalance: string
  lastUpdated: number
}[]
```

#### GET /api/robot/:robotId/state
Fetch state for a specific robot.

**Response**: Same as single robot from `/api/robots`

## File Structure

```
frontend/
├── app/warehouse/page.tsx              # Main warehouse page with all UI
├── components/
│   ├── ui/
│   │   ├── TaskManager.tsx             # Task creation and management UI
│   │   ├── AgentInventory.tsx          # Agent inventory and spawn UI
│   │   ├── CommunicationLog.tsx        # YouTube-style communication feed
│   │   ├── ToastNotification.tsx       # Toast notifications
│   │   └── AlertOverlay.tsx            # Alert modal
│   └── scene/
│       ├── DepartmentScene.tsx         # 3D scene with agents
│       ├── SpeechBubble.tsx            # 3D speech bubbles
│       └── CommBeam.tsx                # Visual connection beams
├── lib/
│   ├── agentStore.ts                   # Zustand store (state management)
│   ├── useBackendSocket.ts             # WebSocket integration hook
│   ├── useBackendApi.ts                # REST API client hook
│   └── useCommunication.ts             # Communication system logic
└── .env.local                          # Frontend environment variables

backend/
├── src/
│   ├── orchestrator/index.ts           # WebSocket + REST API server
│   ├── robot/index.ts                  # Robot agent decision loop
│   ├── spawner/index.ts                # Dynamic robot spawning
│   ├── shared/
│   │   ├── redis/                      # Redis operations
│   │   ├── types/                      # TypeScript types
│   │   └── x402/                       # Payment system
│   └── robot/agentLog.ts               # Agent logging system
└── .env                                # Backend environment variables
```

## Next Steps

1. **Extend Task Types**: Add more task types beyond simple zone-to-zone operations
2. **Agent Analytics**: Add charts showing agent performance over time
3. **Task History**: Add completed task history view
4. **Multi-Agent Coordination**: Visualize complex multi-agent task execution
5. **Blockchain Explorer**: Add link to view on-chain transactions
6. **Agent Chat**: Add ability to send custom messages to agents
7. **Performance Metrics**: Add agent efficiency and success rate tracking

## Support

For issues or questions:
- Check backend logs: `tail -f backend/logs/*.log`
- Check frontend console for errors
- Review Redis state: `redis-cli MONITOR`
- Verify blockchain transactions on Base Sepolia explorer
