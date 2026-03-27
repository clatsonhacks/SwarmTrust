# SwarmTrust Local Setup Guide

Complete steps to run the SwarmTrust backend locally for frontend development.

---

## Prerequisites

- Node.js v18+
- Redis installed (`sudo apt install redis` on Ubuntu/WSL)
- All wallet private keys in `.env`

---

## Step 1 — Install Dependencies

```bash
cd /home/clatson/swarmtrust
npm install
```

---

## Step 2 — Start Redis

```bash
sudo redis-server --daemonize yes
```

Verify it is running:

```bash
redis-cli ping
# Expected: PONG
```

---

## Step 3 — Start All 5 Robots

Open 5 separate terminals, run one robot per terminal:

```bash
# Terminal 1 — scout-1 (NAVIGATE, SCAN) — port 3001
cd /home/clatson/swarmtrust
ROBOT_ID=scout-1 npx tsx src/robot/index.ts

# Terminal 2 — lifter-2 (NAVIGATE, LIFT) — port 3002
cd /home/clatson/swarmtrust
ROBOT_ID=lifter-2 npx tsx src/robot/index.ts

# Terminal 3 — scout-3 (NAVIGATE, SCAN) — port 3003
cd /home/clatson/swarmtrust
ROBOT_ID=scout-3 npx tsx src/robot/index.ts

# Terminal 4 — carrier-4 (NAVIGATE, CARRY) — port 3004
cd /home/clatson/swarmtrust
ROBOT_ID=carrier-4 npx tsx src/robot/index.ts

# Terminal 5 — lifter-5 (NAVIGATE, LIFT) — port 3005
cd /home/clatson/swarmtrust
ROBOT_ID=lifter-5 npx tsx src/robot/index.ts
```

---

## Step 4 — Start Orchestrator

Open a new terminal:

```bash
cd /home/clatson/swarmtrust
npx tsx src/orchestrator/index.ts
```

The orchestrator exposes the WebSocket server on port 8080.

---

## Step 5 — Verify Everything Is Running

```bash
# All 5 robots should appear
redis-cli keys "robot:*:config"

# Health check each robot
curl http://localhost:3001/health   # scout-1
curl http://localhost:3002/health   # lifter-2
curl http://localhost:3003/health   # scout-3
curl http://localhost:3004/health   # carrier-4
curl http://localhost:3005/health   # lifter-5
```

Each health response looks like:
```json
{
  "agentId": "scout-1",
  "name": "SwarmTrust-Scout-1",
  "capabilities": ["NAVIGATE", "SCAN"],
  "state": "IDLE",
  "walletAddress": "0x..."
}
```

---

## Step 6 — Push a Test Task

```bash
redis-cli rpush tasks:queue '{"taskId":"task-001","description":"Move pallet from INTAKE to STORAGE","priority":1,"createdAt":1000}'
```

Watch the robot terminals — one robot will pick it up, decompose it via Groq, execute or delegate subtasks, and upload the log to Pinata.

---

## Frontend Connection

Add these to your frontend `.env.local`:

```
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:3001
```

| Channel | URL | Data |
|---------|-----|------|
| WebSocket | `ws://localhost:8080` | Real-time robot state, task events, CIDs |
| scout-1 API | `http://localhost:3001/health` | Robot status |
| lifter-2 API | `http://localhost:3002/health` | Robot status |
| scout-3 API | `http://localhost:3003/health` | Robot status |
| carrier-4 API | `http://localhost:3004/health` | Robot status |
| lifter-5 API | `http://localhost:3005/health` | Robot status |

### WebSocket events your frontend receives

| Event type | When | Key fields |
|------------|------|------------|
| `STATE_CHANGED` | Robot changes state | `robotId`, `state` (IDLE/MOVING/EXECUTING/WAITING) |
| `TASK_COMPLETED` | Task finishes | `taskId`, `payload.logCid`, `payload.logUrl` |

---

## Shutdown

```bash
# Stop all robots and orchestrator
pkill -f "tsx src/robot/index.ts"
pkill -f "tsx src/orchestrator/index.ts"

# Stop Redis
sudo redis-cli shutdown
```
