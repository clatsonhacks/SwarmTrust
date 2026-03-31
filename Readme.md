# DeWare
## Autonomous Multi-Robot Warehouse Coordination — On-Chain Identity, Reputation & Machine Payments

> Five autonomous robot agents coordinate a warehouse entirely without human intervention. They discover each other on-chain, pay each other in USDC via HTTP micropayments, and write reputation scores to a blockchain registry after every delegation. Every decision, payment, and outcome is verifiable on Base Sepolia.

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Idea](#2-the-idea)
3. [What DeWare Actually Is](#3-what-deware-actually-is)
4. [What You See on Screen](#4-what-you-see-on-screen)
5. [System Architecture](#5-system-architecture)
6. [The Full Workflow — Step by Step](#6-the-full-workflow--step-by-step)
7. [Blockchain Layer](#7-blockchain-layer)
8. [x402 Machine Payments](#8-x402-machine-payments)
9. [Backend Deep Dive](#9-backend-deep-dive)
10. [Frontend Deep Dive](#10-frontend-deep-dive)
11. [Real vs Simulated](#11-real-vs-simulated)
12. [Complete Tech Stack](#12-complete-tech-stack)
13. [Running the System](#13-running-the-system)
14. [Environment Variables](#14-environment-variables)
15. [Track Compliance](#15-track-compliance)

---

## 1. The Problem

Autonomous robots operating in shared environments — warehouses, factories, logistics networks — face a coordination problem that no current system solves without a centralized controller.

**Trust:** When Robot A needs Robot B to complete a sub-task, how does it know Robot B is actually capable and trustworthy? Today's reputation lives in a centralized database owned by the fleet operator. If it's tampered with or goes offline, trust collapses.

**Payment:** When one robot delegates work to another in a cross-fleet or cross-operator scenario, payment requires a human to authorize every transaction. There is no mechanism for Machine A to autonomously pay Machine B, verify delivery, and settle — without a human signature.

**Auditability:** When a multi-robot task fails, there is no tamper-proof record of which robot decided to delegate to which peer, what the reasoning was, or whether payment was made.

**Decentralization:** Every current multi-robot coordination system has a central controller. If it goes down, the fleet stops.

DeWare solves all four simultaneously.

---

## 2. The Idea

Treat every robot as an autonomous economic actor with its own on-chain identity, reputation, and wallet.

Each robot:
- Has an **ERC-8004 identity** — a blockchain-registered agent passport proving its existence, capabilities, and operator
- Has a **reputation score on-chain** — updated after every task based on success or failure, readable by any peer
- Has an **autonomous wallet** — holding testnet USDC, able to send and receive micropayments without human signing
- Runs a **continuous decision loop** — polls for tasks, decomposes them with an LLM, selects peers by on-chain reputation, pays them via x402 HTTP micropayments, and writes reputation outcomes back on-chain

When Robot A needs help, it does not ask a central controller. It queries the ERC-8004 registry directly, reads reputation scores, picks the most trusted available peer above a minimum threshold, and initiates an x402 HTTP payment to that peer's endpoint. The peer verifies the payment was settled on-chain before executing the task. The entire interaction — peer discovery, payment, execution, reputation update — is autonomous, verifiable, and logged.

---

## 3. What DeWare Actually Is

DeWare is a browser-based real-time 3D warehouse simulation backed by five live Node.js robot agent processes running genuine blockchain integrations.

**It is not a mockup.** The x402 USDC transfers actually happen on Base Sepolia. The ERC-8004 reputation writes are real on-chain transactions. The Groq LLM is called to decompose every task. Completed task logs are uploaded to IPFS via Pinata. You can click VERIFY on any payment in the comm log and see the transaction on Basescan.

### The Five Robots

| Robot ID | Name | Capabilities | Zone | Color |
|----------|------|-------------|------|-------|
| scout-1 | Scout-1 | NAVIGATE, SCAN | INTAKE | Cyan |
| lifter-2 | Lifter-1 | NAVIGATE, LIFT, CARRY | STORAGE | Lime |
| scout-3 | Scout-2 | NAVIGATE, SCAN | STAGING | Purple |
| carrier-4 | Carrier-1 | NAVIGATE, CARRY | DISPATCH | Orange |
| lifter-5 | Lifter-2 | NAVIGATE, LIFT, CARRY | INTAKE | Red |

### The Three Pillars

**Pillar 1 — Verifiable Identity (ERC-8004)**
Every robot is registered on the ERC-8004 Identity Registry on Base Sepolia (contract `0x8004A818BFB912233c491871b3d84c89A494BD9e`). Each registration mints an ERC-721 NFT — the robot's on-chain passport — containing its capabilities, operator wallet, and endpoint URL.

**Pillar 2 — On-Chain Reputation**
The ERC-8004 Reputation Registry (contract `0x8004B663056A597Dffe9eCcC1965A193B7388713`) maintains a score per agent token ID. After every delegation, the delegating robot calls `giveFeedback()` on-chain: +80 for success, −50 for timeout. These accumulate into a score that any robot reads before deciding to trust a peer.

**Pillar 3 — Machine Micropayments (x402)**
Every robot runs an Express HTTP server. Task endpoints are protected by `@x402/express` middleware. When Robot A wants Robot B to execute a sub-task, it sends an HTTP request to Robot B's endpoint. Robot B responds with HTTP 402 specifying the USDC amount required. Robot A's `@x402/fetch` client automatically signs an EIP-3009 gasless transfer authorization, retries with the payment in the header, and Robot B's middleware verifies on-chain settlement before executing. No human signs anything. Amount: $0.01 USDC per sub-task.

---

## 4. What You See on Screen

The browser interface at `http://localhost:3006` has three main views.

### 4.1 Warehouse Overview

The landing view shows the full warehouse with a top navigation bar and split-panel layout.

**Top Navbar** — Fixed 48px bar: DeWare logo, TASKS button (opens task manager), AGENTS button (opens agent inventory), live connection indicator.

**Left Panel — 3D Warehouse Scene**
A full 3D warehouse rendered with React Three Fiber and Three.js. The warehouse is divided into four color-coded zones: INTAKE (green glow), STORAGE (blue glow), STAGING (yellow glow), DISPATCH (red glow). Five robots move autonomously through the scene, each rendered as a distinct 3D model:
- INTAKE: Box robot (`box-02_robot.glb`)
- STORAGE: Turret droid (`turret_droid.glb`)
- STAGING: Steampunk combat robot (`combat_steampunk_robot.glb`)
- DISPATCH: Bee drone (`bee.glb`)

When a payment flows between two robots, a **TrustBeam** — a Bézier arc particle effect in the payer's color — travels between them in 3D space. When robots communicate or meet, **CommBeams** and **SpeechBubbles** appear above them.

**Right Panel — Agent Panel + Comm Log**

The right panel is split between:
- **Agent Panel** (top): Shows all five agents with their current state (IDLE / MOVING / EXECUTING / DELEGATING / COMMUNICATING), colored state badges, reputation bars, USDC balances, zone occupancy visualization, and a live Agent Log feed showing every backend event — state transitions, task assignments, task completions.
- **Comm Log** (embedded, bottom-right in overview): Shows inter-agent communication events. Each entry shows FROM → TO with agent colors, the USDC amount in large white text, the zone route (INTAKE → STORAGE), and a VERIFY ↗ button linking to Basescan for on-chain payment confirmation.

### 4.2 Department Scene Views

Clicking any of the four department cards on the overview drops you into an immersive 3D first-person view of that specific hub. The full warehouse 3D model is loaded with the camera positioned inside that zone (camera positions from Blender: CAM_Intake_Bay, CAM_Storage, CAM_Charging_Station, CAM_Dispatch).

Robots from that zone patrol their area autonomously — moving between task waypoints, executing warehouse operations. Each department scene shows:
- **Department header** (below the navbar): back button, zone name in zone color, agent count
- **Zone Activity Log** (bottom-right overlay): Live log entries filtered to only show events involving robots assigned to that zone. INTAKE shows scout-1 and lifter-5 activity. STORAGE shows lifter-2. STAGING shows scout-3. DISPATCH shows carrier-4.
- **Reset View** button to return camera to default position

### 4.3 Modals

**Task Manager** (TASKS button in navbar): View and create warehouse tasks. Shows task ID, description, priority, status, and assigned robot. Priority-colored left borders. Site-aesthetic dark styling.

**Agent Inventory** (AGENTS button in navbar): Full agent roster with capability badges, behavioral state, reputation scores, USDC balances, wallet addresses, and the ability to spawn new robot types.

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL NETWORKS                                               │
│  Base Sepolia (ERC-8004 identity + reputation, x402 settlement) │
│  Coinbase CDP (x402 facilitator service)                        │
│  Groq API (LLM task decomposition — llama-3.3-70b-versatile)   │
│  Pinata IPFS (agent log storage after task completion)          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  BACKEND — Node.js + TypeScript                                  │
│                                                                  │
│  Orchestrator (port 8080 WS + 3000 REST)                        │
│  ├── WebSocket server → broadcasts all robot events to frontend  │
│  ├── Redis pub/sub subscriber → robot:*:events                  │
│  ├── Task generator → refills queue every 15s if < 3 tasks      │
│  └── Stats broadcaster → SESSION_STATS every 5s                 │
│                                                                  │
│  Robot Agents x5 (ports 3001–3005)                              │
│  ├── Decision loop: poll Redis → decompose (Groq) → execute     │
│  ├── Peer selection: ERC-8004 query → reputation filter         │
│  ├── x402 payments: @x402/fetch client + @x402/express server   │
│  ├── On-chain reputation: viem writeContract → giveFeedback()   │
│  └── Log upload: Pinata SDK → IPFS CID returned                 │
│                                                                  │
│  Redis                                                           │
│  ├── tasks:queue (BLPOP — atomic task distribution)             │
│  ├── robot:{id}:state (position, state, task, reputation)       │
│  ├── robot:{id}:config (endpoint, capabilities, wallet)         │
│  ├── zone:{name}:lock (TTL-based zone locking for safety)       │
│  └── robot:{id}:events (pub/sub event channel)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket (ws://localhost:8080)
┌──────────────────────────▼──────────────────────────────────────┐
│  FRONTEND — Next.js 14 + React Three Fiber                      │
│                                                                  │
│  useBackendSocket.ts — maps WS events → Zustand store           │
│  agentStore.ts — Zustand: agents, log, beams, stats, tasks      │
│                                                                  │
│  Views:                                                          │
│  ├── DepartmentOverview — full warehouse + AgentPanel           │
│  ├── DepartmentScene — per-zone immersive 3D view               │
│  ├── TaskManager modal                                           │
│  └── AgentInventory modal                                        │
│                                                                  │
│  3D Components:                                                  │
│  ├── WarehouseScene — full overview with all zones              │
│  ├── TrustBeam — Bézier arc payment visualization               │
│  ├── CommBeam — communication visualization                     │
│  ├── SpeechBubble — agent speech overlays                       │
│  └── AmongAgent — individual robot renderer + animation         │
│                                                                  │
│  UI Components:                                                  │
│  ├── AgentPanel — states, reputation, logs, zone bars           │
│  ├── CommunicationLog — payment/delegation entries + Basescan   │
│  └── ToastNotification — real-time event toasts                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. The Full Workflow — Step by Step

### Step 0 — Startup

Five robot processes start simultaneously (each in a separate tmux window or terminal):
```
npm run robot:1   # scout-1  — NAVIGATE, SCAN  — port 3001
npm run robot:2   # lifter-2 — NAVIGATE, LIFT, CARRY — port 3002
npm run robot:3   # scout-3  — NAVIGATE, SCAN  — port 3003
npm run robot:4   # carrier-4 — NAVIGATE, CARRY — port 3004
npm run robot:5   # lifter-5 — NAVIGATE, LIFT, CARRY — port 3005
```

Each robot initializes: loads its private key → starts Express server with x402 middleware → publishes its endpoint and capabilities to Redis → begins polling the task queue.

The orchestrator starts: connects to Redis → starts WebSocket server → seeds the task queue with warehouse tasks → begins the task generator interval.

### Step 1 — Task Acquisition

The orchestrator pushes task objects to `tasks:queue`. Example task:
```json
{
  "taskId": "task-558",
  "description": "Move pallet from INTAKE to STORAGE",
  "sourceZone": "INTAKE",
  "destZone": "STORAGE",
  "priority": "HIGH"
}
```

The first robot to execute `BLPOP tasks:queue` claims the task atomically. No two robots can receive the same task. The robot immediately publishes a `STATE_CHANGED` event to its Redis channel, which the orchestrator forwards to the frontend WebSocket, which updates the 3D scene and Agent Log.

### Step 2 — Task Decomposition (Groq LLM)

The robot sends the task description and its own capability list to Groq (model: `llama-3.3-70b-versatile`). The response is a structured JSON array:

```json
[
  { "subTaskId": "st-1", "description": "Navigate to INTAKE zone",   "requiredCapability": "NAVIGATE", "estimatedDurationSecs": 3,  "irreversible": false },
  { "subTaskId": "st-2", "description": "Lift pallet at INTAKE",     "requiredCapability": "LIFT",     "estimatedDurationSecs": 5,  "irreversible": false },
  { "subTaskId": "st-3", "description": "Carry pallet to STORAGE",   "requiredCapability": "CARRY",    "estimatedDurationSecs": 8,  "irreversible": false },
  { "subTaskId": "st-4", "description": "Place pallet at STORAGE",   "requiredCapability": "LIFT",     "estimatedDurationSecs": 4,  "irreversible": true  }
]
```

A token bucket rate limiter enforces 50 Groq calls per robot per hour. If quota is exceeded, the robot falls back to rule-based regex decomposition.

### Step 3 — Capability Check & Peer Selection

For each sub-task, the robot checks its own capability list:
- **Self-capable:** Execute directly. Publish `STATE_CHANGED` → EXECUTING. Simulate execution. Publish `STATE_CHANGED` → IDLE.
- **Peer required:** Begin the peer selection flow.

Peer selection queries Redis for all robots that have published the required capability. It checks each candidate's reputation from the on-chain ERC-8004 Reputation Registry (cached with 30-second TTL). Any candidate below the trust threshold (80) is filtered out. From the passing candidates, the highest-reputation robot is selected. This decision is logged to `agent_log.json`.

### Step 4 — x402 Payment (Machine-to-Machine USDC)

The selecting robot constructs an HTTP POST to the peer's task endpoint using `@x402/fetch`:

```
POST http://localhost:3002/task
Body: { subTaskId, description, requiredCapability, estimatedDurationSecs, irreversible }
```

The peer's Express server returns **HTTP 402 Payment Required**:
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "10000",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0x<peer-wallet-address>"
  }]
}
```

The `@x402/fetch` client reads the payment specification, constructs an **EIP-3009 TransferWithAuthorization** payload (gasless USDC transfer — the client only signs, the Coinbase CDP facilitator pays the gas), signs it with the robot's private key using viem, and retries the request with the signed authorization in the `X-PAYMENT` header.

The peer's `@x402/express` middleware forwards the header to the Coinbase CDP facilitator, which submits the EIP-3009 transfer on-chain and returns a transaction hash. The middleware allows the request through once settlement is confirmed.

The paying robot publishes `PAYMENT_SENT` with the txHash. The frontend shows a TrustBeam arc between the two robots and adds a comm log entry. The receiving robot publishes `PAYMENT_RECEIVED` with the real on-chain txHash — this is what powers the VERIFY ↗ Basescan link in the comm log.

### Step 5 — Sub-Task Execution

The peer robot executes the sub-task. For sub-tasks flagged `irreversible: true`, it first acquires a Redis zone lock (`SET zone:{name}:lock NX PX 10000`) to prevent concurrent conflicting operations. If the lock is held by another robot, the sub-task is queued for retry (up to 3 attempts). On success, the robot returns `{ success: true }` via HTTP response.

### Step 6 — Reputation Update (On-Chain)

The delegating robot receives the HTTP response. If successful within the expected time window, it calls the ERC-8004 Reputation Registry via viem:

```typescript
await walletClient.writeContract({
  address: REPUTATION_REGISTRY_ADDRESS,  // 0x8004B663056A597Dffe9eCcC1965A193B7388713
  abi: reputationAbi,
  functionName: 'giveFeedback',
  args: [peerTokenId, 80n, 'WAREHOUSE_DELEGATION', endpoint, feedbackHash]
})
```

On timeout or failure: `giveFeedback` is called with `−50`. The resulting `txHash` is logged and published as `REPUTATION_UPDATED`, which the frontend reflects immediately in the Agent Panel reputation bars.

### Step 7 — Task Completion & Log Upload

Once all sub-tasks resolve, the robot composes a task summary and uploads `agent_log.json` to Pinata IPFS. Pinata returns a CID. The robot broadcasts `TASK_COMPLETED` with `logCid` and `logUrl`. The orchestrator updates `session:stats` and the frontend dashboard reflects the new task count and total USDC transferred.

---

## 7. Blockchain Layer

### ERC-8004 Identity Registry

- **Network:** Base Sepolia (chain ID 84532)
- **Contract:** `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **Purpose:** Mints an ERC-721 NFT per robot containing capabilities, operator wallet, and payment endpoint
- **Registered token IDs:** 2943, 2944, 2945, 2946, 2947 (one per robot)
- **Registration function:** `registerOnChain()` + `setCapabilitiesOnChain()` (called at robot startup if no token ID exists)

### ERC-8004 Reputation Registry

- **Contract:** `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- **Purpose:** Accumulates success/failure signals per agent token ID into a 0–100 reputation score
- **Write:** `giveFeedback(agentId, delta, tag, endpoint, feedbackHash)` — called by delegating robot after every delegation
- **Read:** `getReputation(agentId)` — called during peer selection, cached 30 seconds
- **Values:** +80 on success, −50 on timeout/failure

### x402 USDC Payments

- **Token:** USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- **Amount per delegation:** $0.01 USDC (10000 in 6-decimal precision)
- **Settlement:** EIP-3009 gasless transfer via Coinbase CDP facilitator
- **Verification:** Real txHashes appear on [Base Sepolia Basescan](https://sepolia.basescan.org)

---

## 8. x402 Machine Payments

x402 is an open protocol developed by Coinbase that revives HTTP 402 "Payment Required" for automated stablecoin micropayments. It is how DeWare's robots pay each other.

### Server Setup (every robot)
```typescript
import { paymentMiddleware } from '@x402/express'

app.use(paymentMiddleware(receivingWalletAddress, {
  '/task': {
    price: '$0.01',
    network: 'base-sepolia',
    config: { description: 'Warehouse sub-task execution' }
  }
}))
```

### Client Usage (paying robot)
```typescript
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch'

const fetch402 = wrapFetchWithPaymentFromConfig({
  privateKey: ROBOT_PRIVATE_KEY,
  network: 'base-sepolia'
})

const response = await fetch402(`http://localhost:${peerPort}/task`, {
  method: 'POST',
  body: JSON.stringify(subTask)
})
// x402/fetch automatically handles the 402 → sign → retry flow
```

### What Actually Happens on-chain
1. Robot A's `@x402/fetch` receives HTTP 402 from Robot B
2. It constructs an EIP-3009 `TransferWithAuthorization` signature (no gas from Robot A)
3. Robot B's `@x402/express` middleware sends the signature to Coinbase CDP facilitator
4. CDP submits the USDC transfer on Base Sepolia — creates a real blockchain transaction
5. `ctx.result.transaction` contains the on-chain txHash
6. Robot B's `onAfterSettle` publishes `PAYMENT_RECEIVED` with the real txHash
7. Frontend shows VERIFY ↗ link to Basescan

---

## 9. Backend Deep Dive

### File Structure
```
backend/
├── src/
│   ├── orchestrator/
│   │   └── index.ts          # WebSocket server, task generator, stats broadcaster
│   ├── robot/
│   │   └── index.ts          # Robot agent process — main decision loop
│   ├── blockchain/
│   │   ├── erc8004.ts        # Identity registry read/write via viem
│   │   └── reputation.ts     # Reputation read/write via viem
│   ├── decomposer/
│   │   └── taskDecomposer.ts # Groq LLM integration + rule-based fallback
│   ├── storage/
│   │   ├── pinataUploader.ts # Pinata IPFS upload (active)
│   │   └── storachaUploader.ts # Storacha upload (stubbed — env vars not set)
│   └── utils/
│       ├── redis.ts          # Redis client + publishEvent helper
│       └── tokenBucket.ts    # Rate limiter for Groq API calls
├── agents/
│   └── manifests/
│       ├── scout-1.json      # ERC-8004 agent manifest
│       ├── lifter-2.json
│       ├── scout-3.json
│       ├── carrier-4.json
│       └── lifter-5.json
└── package.json
```

### Decision Loop (per robot, every 500ms)
```
1. BLPOP tasks:queue (1s timeout)
   ├── No task → publish STATE_CHANGED:IDLE → continue
   └── Task received →
       2. Publish STATE_CHANGED:EXECUTING + TASK_STARTED
       3. Call Groq API → get sub-task array (or fallback decomposition)
       4. For each sub-task:
          ├── Own capability → execute directly → simulate duration
          └── Peer required →
              5. Query Redis for peers with capability
              6. Read ERC-8004 reputation for each candidate
              7. Filter by trustThreshold (80) → pick highest score
              8. Publish PEER_DELEGATION event
              9. x402 POST to peer endpoint
             10. Receive payment response → publish PAYMENT_SENT
             11. Wait for peer response (30s timeout)
             12. On success → giveFeedback(+80) → publish REPUTATION_UPDATED
             13. On timeout → giveFeedback(-50) → publish REPUTATION_UPDATED
       5. Update session stats in Redis
       6. Compose task summary → upload to Pinata
       7. Publish TASK_COMPLETED with logCid
       8. Loop
```

### Events Emitted (via Redis pub/sub → WebSocket)

| Event | Payload | Frontend Effect |
|-------|---------|-----------------|
| `STATE_CHANGED` | robotId, state, taskId | Agent badge color + 3D robot animation |
| `TASK_STARTED` | robotId, taskId | Agent Log entry |
| `TASK_COMPLETED` | robotId, taskId, logCid, logUrl | Task counter + Agent Log |
| `PAYMENT_SENT` | robotId, to, amountUsdc, txHash | TrustBeam arc + Comm Log entry |
| `PAYMENT_RECEIVED` | robotId, from, amountUsdc, txHash | Comm Log VERIFY button (real txHash) |
| `PEER_DELEGATION` | robotId, to, capability | Comm Log delegation entry |
| `REPUTATION_UPDATED` | robotId, delta, txHash | Reputation bar animation |
| `LOG_ENTRY` | message, logType | Agent Log entry |
| `SESSION_STATS` | tasksCompleted, totalUsdcTransferred, onChainTransactionCount | Dashboard counters |

---

## 10. Frontend Deep Dive

### File Structure
```
frontend/
├── app/
│   ├── warehouse/
│   │   └── page.tsx          # Main page — navbar, view routing, modal state
│   └── globals.css           # Design tokens, all component styles
├── components/
│   ├── scene/
│   │   ├── DepartmentOverview.tsx    # Full warehouse view + AgentPanel + CommLog
│   │   ├── DepartmentScene.tsx       # Per-zone immersive 3D view
│   │   ├── WarehouseScene.tsx        # Full warehouse 3D overview scene
│   │   ├── AmongAgent.tsx            # Individual robot renderer (R3F)
│   │   ├── TrustBeam.tsx             # Bézier arc payment visualization
│   │   ├── CommBeam.tsx              # Agent communication beam
│   │   └── SpeechBubble.tsx          # Robot speech overlays
│   └── ui/
│       ├── AgentPanel.tsx            # Agent cards + stats + Agent Log
│       ├── CommunicationLog.tsx      # Payment/delegation events + Basescan
│       ├── TaskManager.tsx           # Task management modal
│       ├── AgentInventory.tsx        # Agent roster + spawn modal
│       └── ToastNotification.tsx     # Real-time event toasts
├── lib/
│   ├── agentStore.ts         # Zustand store — single source of truth
│   ├── useBackendSocket.ts   # WebSocket → Zustand event mapping
│   ├── useCommunication.ts   # Comm log entry parser + simulated comms
│   └── types.ts              # TypeScript types
└── public/
    └── models/               # 3D robot GLB/GLTF files
```

### State Flow
```
WebSocket message
  ↓
useBackendSocket.ts
  ├── STATE_CHANGED     → store.setAgentState(id, state, taskId)
  ├── PAYMENT_SENT      → store.fireBeam(fromId, toId) + store.addLog(...)
  ├── PAYMENT_RECEIVED  → store.addLog(..., realTxHash)
  ├── REPUTATION_UPDATED → store.setAgentReputation(id, newScore)
  ├── TASK_COMPLETED    → store.updateTaskStatus(...)
  └── SESSION_STATS     → store.updateStats(...)
  ↓
Zustand agentStore (reactive)
  ↓
React components re-render:
  ├── AgentPanel      ← agents[], log[]
  ├── CommunicationLog ← commLog[] (from useCommunication)
  ├── WarehouseScene  ← beams[], agents[].position
  └── DepartmentScene ← log[] filtered by zone robots
```

### Design System

CSS variables used throughout:
- `--bg`: `#070810` — deep navy background
- `--accent`: `#c5ff2b` — lime highlight (TASKS, AGENTS, counts)
- `--font-mono`: Geist Mono — labels, codes, log entries
- `--font-sans`: Geist Sans — names, values, amounts
- Colors: cyan `#5cc8ff` (Scout-1), lime `#c5ff2b` (Lifter-1), purple `#cc44ff` (Scout-2), orange `#ff9b2b` (Carrier-1), red `#ff4466` (Lifter-2)

---

## 11. Real vs Simulated

| Component | Status | Detail |
|-----------|--------|--------|
| x402 USDC payments | ✅ **Real** | EIP-3009 transfers on Base Sepolia, verifiable on Basescan |
| ERC-8004 reputation writes | ✅ **Real** | `giveFeedback()` on-chain after every delegation |
| ERC-8004 identity registry | ✅ **Real** | 5 registered agents, token IDs 2943–2947 |
| Groq LLM decomposition | ✅ **Real** | API calls, rate-limited, cached, with fallback |
| Pinata IPFS log upload | ✅ **Real** | CID returned after every task completion |
| Redis task queue | ✅ **Real** | BLPOP atomic distribution, pub/sub events |
| WebSocket event stream | ✅ **Real** | All 5 robots → Redis → orchestrator → frontend |
| 3D visualization | ✅ **Real** | Three.js + R3F, live state from WebSocket |
| Task execution timing | ⚙️ **Simulated** | `setTimeout(estimatedDurationSecs * 100)` — no real hardware |
| Zone movement | ⚙️ **Simulated** | Hardcoded zone positions, not GPS/physical |
| Robot spawning UI | ⚙️ **Partial** | Backend endpoint exists, no frontend form |
| Storacha IPFS | ❌ **Stubbed** | Env vars not set; Pinata is active |

---

## 12. Complete Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | Framework, routing, SSR |
| React 18 | UI component tree |
| React Three Fiber | React bindings for Three.js |
| @react-three/drei | Three.js helpers (GLTF loader, OrbitControls, Html, Environment) |
| Three.js r165 | 3D rendering engine |
| Zustand 4.5 | Global state management |
| TypeScript 5 | Type safety |
| Tailwind CSS | Utility styling |

### Backend

| Technology | Purpose |
|------------|---------|
| Node.js 20 | Runtime |
| TypeScript 5 | Type safety |
| Express 5.2 | HTTP server per robot |
| ws | WebSocket server (orchestrator) |
| ioredis 5.10 | Redis client |
| viem 2.47 | Ethereum/EVM interaction |
| @x402/express | x402 payment middleware (server-side) |
| @x402/fetch | x402 payment client (robot-to-robot) |
| groq-sdk 1.1 | LLM task decomposition |
| pinata 2.5 | IPFS log upload |
| pino 10.3 | Structured logging |

### Blockchain

| Component | Detail |
|-----------|--------|
| Network | Base Sepolia (chain ID 84532) |
| RPC | `https://sepolia.base.org` |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| USDC Token | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| x402 Facilitator | Coinbase CDP |
| Payment scheme | EIP-3009 gasless transfer (exact EVM scheme) |

---

## 13. Running the System

### Prerequisites
- Node.js 20+
- Redis running on `localhost:6379`
- All env vars configured (see Section 14)

### Start Backend
```bash
cd Deware/backend

# Terminal 1 — Orchestrator
npm run orchestrator

# Terminal 2-6 — One per robot
npm run robot:1
npm run robot:2
npm run robot:3
npm run robot:4
npm run robot:5
```

Or use tmux:
```bash
tmux new-session -s deware
# Window 0: orchestrator
# Windows 1-5: robots 1-5
tmux switch -t deware
```

### Start Frontend
```bash
cd Deware/frontend
npm run dev
# → http://localhost:3006
```

### Verify System is Running
- Frontend should show `● LIVE` in the navbar (WebSocket connected)
- Agent states should change from IDLE → EXECUTING in the Agent Panel
- TrustBeam arcs should appear between robots during delegation
- VERIFY ↗ buttons in the Comm Log should link to real Basescan transactions

---

## 14. Environment Variables

### Backend `.env`
```
REDIS_URL=redis://localhost:6379

# Groq LLM
GROQ_API_KEY=<your-groq-api-key>

# Base Sepolia
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_REGISTRY_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713

# Robot wallets (5 separate funded Base Sepolia wallets)
ROBOT_1_PRIVATE_KEY=0x...
ROBOT_2_PRIVATE_KEY=0x...
ROBOT_3_PRIVATE_KEY=0x...
ROBOT_4_PRIVATE_KEY=0x...
ROBOT_5_PRIVATE_KEY=0x...

# Pinata IPFS
PINATA_JWT=<your-pinata-jwt>
```

### Frontend `.env.local`
```
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 15. Track Compliance

### x402 + Blockchain Payments Track

| Requirement | Implementation |
|-------------|---------------|
| Use x402 protocol for payments | `@x402/express` on every robot's `/task` endpoint; `@x402/fetch` as payment client |
| Payments on Base Sepolia | USDC transfers on chain ID 84532, verified on Basescan |
| Machine-to-machine (no human signing) | EIP-3009 gasless authorization — robot signs, CDP facilitator submits |
| Payment triggers real action | x402 middleware verifies settlement before sub-task executes |
| Verifiable on-chain | Real txHashes in VERIFY ↗ Basescan links in Comm Log |

### ERC-8004 Autonomous Agent Track

| Requirement | Implementation |
|-------------|---------------|
| Agent registered on ERC-8004 | 5 robots registered, token IDs 2943–2947 |
| Agent manifest (agent.json) | `backend/agents/manifests/*.json` per robot |
| Runtime log (agent_log.json) | Written continuously, uploaded to Pinata IPFS after every task |
| Verifiable identity | On-chain ERC-721 tokens on Base Sepolia |
| On-chain reputation | `giveFeedback()` called after every delegation |
| Autonomous peer selection | Reputation-filtered candidate selection without human input |
| Safety guardrails | Redis zone locking before irreversible actions; retry queue for failures |
| Compute budget awareness | Token bucket: 50 Groq calls/hour per robot; automatic fallback to rule-based decomposition |
| Multi-agent coordination | 5 concurrent agents sharing task queue, delegating cross-agent sub-tasks |

---

## How It Looks in Action

When you open the browser and the backend is running, here is what happens live:

1. **Agent Panel** shows five agents with colored state badges cycling through IDLE → EXECUTING → DELEGATING as robots pick up tasks
2. **TrustBeam arcs** animate in the 3D scene whenever a payment flows — a glowing colored line traces from the paying robot to the receiving robot
3. **Comm Log** fills with entries showing `LIFTER-5 → SCOUT-3`, the amount `$0.01 USDC` in large white text, the zone route below, and a VERIFY ↗ button for on-chain payments
4. **Agent Log** shows the full decision trail: `scout-1 · navigating · task-561`, `✓ COMPLETE · lifter-2 · task-560`
5. **Stats** in the nav area increment: task count, total USDC transferred
6. **Department views** — click INTAKE BAY and you're inside the warehouse watching robots patrol; the bottom-right panel shows only INTAKE-zone activity logs in real time

Every VERIFY ↗ click opens a real Base Sepolia Basescan transaction showing a USDC transfer between two robot wallet addresses, timestamped and immutable.
