# Deware
## Autonomous Multi-Robot Coordination with On-Chain Trust, Identity & Machine Payments

> PL Genesis: Frontiers of Collaboration Hackathon 2026
> Tracks: AI & Robotics ($6,000) · ERC-8004 Agents With Receipts ($4,004) · Agent Only: Let The Agent Cook ($4,000) · Fresh Code ($5,000)
> Maximum Prize Ceiling: $19,004

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Idea](#2-the-idea)
3. [The Solution](#3-the-solution)
4. [What You See on Screen](#4-what-you-see-on-screen)
5. [System Architecture](#5-system-architecture)
6. [Component Breakdown](#6-component-breakdown)
7. [Full Workflow — Step by Step](#7-full-workflow--step-by-step)
8. [Frontend Deep Dive](#8-frontend-deep-dive)
9. [Backend Deep Dive](#9-backend-deep-dive)
10. [Blockchain Layer Deep Dive](#10-blockchain-layer-deep-dive)
11. [Data Layer Deep Dive](#11-data-layer-deep-dive)
12. [Agent Manifests Specification](#12-agent-manifests-specification)
13. [Complete Tech Stack](#13-complete-tech-stack)
14. [All Documentation References](#14-all-documentation-references)
15. [Development Phases](#15-development-phases)
16. [Track Compliance Checklist](#16-track-compliance-checklist)
17. [Known Risks & Mitigations](#17-known-risks--mitigations)

---

## 1. The Problem

Autonomous robots operating in shared environments — warehouses, factories, logistics networks — face a coordination problem that no current system solves without a centralized controller.

When Robot A finishes its portion of a task and needs Robot B to continue, the following questions have no decentralized answer today:

**Trust problem:** How does Robot A know Robot B is actually capable of the next task? How does it know Robot B has a track record of completing similar tasks without failing? Any reputation data today lives in a centralized database owned by the fleet operator. If that database is tampered with or goes offline, trust collapses.

**Payment problem:** When one robot delegates work to another robot in a cross-fleet or cross-operator scenario, how does payment happen? Today it requires a human to authorize every inter-robot financial transaction. There is no mechanism for Machine A to autonomously pay Machine B for a service, verify the service was delivered, and complete the financial settlement — all without a human signature.

**Auditability problem:** When a multi-robot task fails, who made which decision and why? Current systems either have no logs, or logs that live in mutable databases controlled by the fleet operator. There is no tamper-proof record of which robot decided to delegate to which peer, what the reasoning was, and whether payment was made.

**Decentralization problem:** Every current multi-robot coordination system has a central controller. If it goes down, the entire fleet stops. There is no protocol for robots to self-organize, self-select peers, and self-execute workflows without a master node.

Deware solves all four problems simultaneously.

---

## 2. The Idea

Treat every robot as an autonomous economic actor with its own on-chain identity, reputation, and wallet.

Robots coordinate the same way humans coordinate in a trustless marketplace — by checking credentials, verifying track records, and paying for services rendered. The difference is that everything happens in milliseconds, autonomously, without any human in the loop after the simulation starts.

Each robot has:
- An **ERC-8004 identity** — a blockchain-registered agent passport proving its existence, capabilities, and operator
- A **reputation score** stored on-chain — updated after every task based on success or failure, readable by any peer
- An **autonomous wallet** — holding testnet USDC, able to send and receive micropayments without human signing
- A **decision loop** — a software process that continuously polls for tasks, decomposes them, selects peers, pays them, and logs everything

When Robot A needs help from a peer, it does not ask a central controller. It queries the on-chain registry directly, reads reputation scores, picks the most trusted available peer above a minimum threshold, and initiates an x402 HTTP payment to that peer's endpoint. The peer receives the payment, executes the sub-task, and Robot A updates the peer's reputation on-chain based on the outcome.

The entire interaction — from peer discovery to payment to reputation update — is autonomous, verifiable, and logged.

---

## 3. The Solution

Deware is a browser-based 3D warehouse simulation where five autonomous robot agents coordinate multi-step warehouse tasks entirely without human intervention.

The simulation runs in real time. You watch robots navigate a warehouse grid, pick up tasks, query each other's reputations, pay each other in USDC, and update reputations — while a dashboard alongside the simulation shows every on-chain transaction, every reputation change, and every agent decision as it happens.

The three core pillars of the system are:

**Pillar 1 — Verifiable Identity (ERC-8004)**
Every robot is registered on the ERC-8004 Identity Registry on Base Sepolia. Each registration produces an ERC-721 NFT — the robot's on-chain passport. This passport contains the robot's capabilities (SCOUT, LIFTER, CARRIER), its operator wallet address, its metadata URI pointing to its full agent card on IPFS, and its endpoint URL for receiving payment-gated task requests.

**Pillar 2 — On-Chain Reputation**
The ERC-8004 Reputation Registry maintains a score for each registered agent. After every task, the delegating robot writes a success or failure signal to the registry. These signals accumulate into a score that any robot can read before deciding to trust a peer. Reputation cannot be faked — it requires on-chain transactions, each one costing gas and leaving a permanent trail.

**Pillar 3 — Machine Micropayments (x402)**
Every robot runs an HTTP server. Task endpoints on that server are protected by x402 payment middleware. When Robot A wants Robot B to execute a sub-task, it sends an HTTP request to Robot B's endpoint. Robot B's server responds with HTTP 402 Payment Required, specifying the exact USDC amount required and the payment network. Robot A's x402 client automatically signs an EIP-3009 gasless transfer authorization, retries the request with the payment in the header, and Robot B's server verifies settlement before executing the task. No human signs anything.

---

## 4. What You See on Screen

The browser interface is divided into two panels side by side.

**Left panel — 3D Warehouse Simulation**
A top-down or isometric 3D view of a warehouse floor divided into four named zones: INTAKE, STORAGE, STAGING, and DISPATCH. Five robots move around the grid, each rendered as a distinct colored 3D box with a directional indicator showing facing direction. Robots have three visual states: idle (stationary, dim), moving (animated along pathfinding routes), and executing (pulsing effect while performing a task action). When a payment flows between two robots, a particle effect travels from the paying robot to the receiving robot. When a reputation update happens, a small floating indicator appears above the robot whose reputation changed.

**Right panel — Live Dashboard**
Four sections stacked vertically. The top section shows each robot's current state in a card: name, capability type, current task, reputation score, and USDC balance. The second section shows a live transaction feed — every on-chain event (identity query, reputation read, payment, reputation write) appears as a new row with a timestamp, description, and clickable transaction hash linking to the Base Sepolia block explorer. The third section shows a reputation leaderboard — the five robots ranked by current reputation score, updating in real time as scores change. The fourth section shows the agent execution log feed — a scrolling view of agent decisions as they happen, matching the agent_log.json entries being written in the backend.

---

## 5. System Architecture

The system has four layers. Each layer communicates with the layers adjacent to it through well-defined interfaces.

```
LAYER 4 — EXTERNAL NETWORKS
  Base Sepolia blockchain (ERC-8004 registries, x402 settlement)
  Coinbase CDP (x402 facilitator service)
  Storacha network (immutable log storage)
  IPFS / Pinata (agent card metadata)

LAYER 3 — BLOCKCHAIN INTERFACE
  viem client (read contract state, write transactions)
  ERC-8004 SDK (identity + reputation registry calls)
  x402 payment middleware + client (HTTP payment protocol)
  Storacha client (content-addressed upload)

LAYER 2 — BACKEND ORCHESTRATION
  Node.js Orchestrator Process (task generation, WebSocket broadcast)
  Robot Agent Processes x5 (one per robot, independent decision loops)
  Redis (task queue, real-time shared state between processes)
  Groq LLM API (task decomposition into sub-tasks)

LAYER 1 — FRONTEND SIMULATION
  Three.js scene (3D warehouse rendering)
  Yuka AI library (autonomous agent steering + pathfinding)
  React dashboard (live stats, tx feed, log feed)
  WebSocket client (receives state updates from orchestrator)
```

Every layer is independently replaceable. The blockchain layer could be swapped to Ethereum mainnet. The LLM layer could be swapped from Groq to any provider. The simulation layer could be replaced with a headless CLI demo. The architecture is intentionally modular.

---

## 6. Component Breakdown

### 6.1 Orchestrator Process

The orchestrator is a single Node.js process that acts as the environment manager for the simulation. It does not control the robots — it only manages the task queue and the communication channel to the frontend.

Responsibilities:
- Seeding the Redis task queue with warehouse tasks at simulation start
- Maintaining a WebSocket server that the frontend connects to
- Receiving state update messages from robot agent processes and broadcasting them to the frontend
- Generating new tasks periodically to keep the simulation running continuously
- Maintaining a global simulation clock and task completion counter

The orchestrator has no knowledge of which robot will pick up which task. It simply pushes tasks to a queue and robots poll it independently.

### 6.2 Robot Agent Processes

Five independent Node.js processes, one per robot. Each process runs continuously and is completely isolated from the others — they communicate only through Redis (shared task queue and state channel) and through HTTP (x402 payment calls between each other).

Each robot process has a fixed capability set defined at startup. Robot 1 and Robot 3 are SCOUT type (can navigate and scan). Robot 2 and Robot 5 are LIFTER type (can pick and place objects). Robot 4 is CARRIER type (can transport objects between zones).

Each robot process maintains:
- Its own viem wallet client with a funded testnet private key
- Its own ERC-8004 agent identity (registered at startup)
- Its own Express HTTP server (x402-protected task endpoint)
- Its own agent_log.json file written to disk continuously
- A local reputation cache to avoid querying the blockchain on every peer selection (cached with a 30-second TTL)

### 6.3 Redis Instance

Redis serves two purposes in this architecture. First, it is the task queue — a Redis List where the orchestrator pushes task objects and robots pop from the front using blocking pops. This gives each task to exactly one robot with no duplication.

Second, it is the real-time state channel — robots publish their current position, state, and latest action to Redis Pub/Sub channels. The orchestrator subscribes to all robot channels and forwards state updates to the WebSocket server for the frontend.

Redis is the only shared state between robot processes. The design is intentional — it avoids any direct process-to-process communication that could create tight coupling.

### 6.4 LLM Task Decomposer

When a robot picks up a task from the queue, it sends the task description and its own capability list to the Groq API with a structured prompt asking for a decomposition into ordered sub-tasks, each tagged with the capability type required to execute it.

The response is a JSON array of sub-task objects. The robot iterates through this array. For sub-tasks that match its own capabilities, it executes directly. For sub-tasks that require a capability it does not have, it initiates the peer selection and payment flow.

Groq is used specifically because it has the fastest inference latency of any API-accessible LLM, which matters for simulation responsiveness. The llama-3.1-8b-instant model is sufficient for structured task decomposition — this does not require a large model.

### 6.5 Three.js Simulation Scene

The 3D scene is a self-contained module in the frontend. It receives position and state update messages from the WebSocket client and updates the rendered scene accordingly. It does not make any direct API calls — all data flows through the WebSocket connection from the orchestrator.

Scene elements:
- A flat warehouse floor with a visible grid overlay
- Four colored rectangular zones with labels rendered as HTML overlays using Three.js CSS3DRenderer
- Five robot meshes, each a distinct color corresponding to capability type
- Shelf structures along the warehouse perimeter (static geometry)
- Pallet objects that robots interact with (movable geometry)
- Particle system for payment visualizations (traveling from payer to payee)
- Ambient and directional lighting for depth

Robot movement is handled by Yuka's autonomous agent system. Each robot has a Yuka Vehicle entity with a seek steering behavior. When a position update arrives from the WebSocket, the robot's target position is updated and Yuka smoothly steers the robot mesh toward it each animation frame.

---

## 7. Full Workflow — Step by Step

### Step 0: Pre-Demo Setup (run once)

The registration script queries each robot's agent.json manifest, constructs an ERC-8004 agent card containing the robot's name, capabilities array, payment endpoint URL, and IPFS metadata URI, then calls the Chitin Protocol registration function on Base Sepolia. This produces one ERC-721 token per robot and returns a token ID. Each token ID is saved back into the robot's configuration file. The fund-wallets script then sends testnet USDC from a faucet address to each robot's wallet address to give them spending ability for x402 payments.

### Step 1: Simulation Start

The orchestrator starts and seeds the Redis task queue with ten warehouse tasks. Example tasks: "Move pallet from Zone INTAKE to Zone STORAGE", "Scan all shelves in Zone STAGING and report inventory", "Transport three boxes from Zone STORAGE to Zone DISPATCH". Each task is a JSON object with a unique task ID, a human-readable description, a source zone, a destination zone, and a priority level.

Each of the five robot agent processes starts simultaneously. Each robot initializes its wallet client, loads its ERC-8004 token ID from config, starts its Express payment server on a unique port, subscribes to the Redis state channel, and begins polling the Redis task queue.

### Step 2: Task Acquisition

The first robot to execute a blocking pop on the Redis task queue receives the first task. Blocking pop is atomic — no two robots can receive the same task. The robot immediately publishes a state update to its Redis channel: "I have picked up Task-001". The orchestrator receives this and broadcasts it to the WebSocket server, which sends it to the frontend dashboard.

### Step 3: Task Decomposition

The robot sends the task description and its capability array to the Groq API. The response is a structured array of sub-tasks. For example, "Move pallet from INTAKE to STORAGE" decomposes into: navigate to INTAKE zone (requires NAVIGATE — all robots have this), lift pallet at INTAKE (requires LIFTER), carry pallet to STORAGE (requires CARRIER), place pallet at STORAGE (requires LIFTER).

If the robot is a SCOUT type, it can handle the navigate sub-tasks but not the LIFTER or CARRIER sub-tasks. It marks those for peer delegation.

### Step 4: Peer Discovery (ERC-8004 Identity Registry)

For each sub-task requiring a peer, the robot calls the ERC-8004 Identity Registry contract on Base Sepolia using viem's readContract. It queries for all registered agents tagged with the required capability. The registry returns an array of token IDs and their associated endpoint URLs.

The robot checks its local reputation cache for each candidate. If a candidate's reputation is not cached or the cache entry is older than 30 seconds, it calls the ERC-8004 Reputation Registry to fetch the current score. It filters out any candidate with a reputation score below 80. If no candidates pass the threshold, it logs a failure and skips that sub-task.

### Step 5: Peer Selection

From the filtered list of trusted candidates, the robot selects the one with the highest reputation score. In the event of a tie, it selects the one with the lowest current task load (determined by querying the Redis state channel for each candidate's reported state). The selection decision — including the list of candidates, their scores, and the reason for the final selection — is written to agent_log.json.

### Step 6: Payment Initiation (x402)

The robot constructs an HTTP POST request to the selected peer's task endpoint URL, containing the sub-task description as the request body. It uses the x402 fetch wrapper instead of a standard HTTP client.

The peer's Express server receives the request and returns HTTP 402 Payment Required with a payment specification in the response headers: the exact USDC amount required (e.g. 0.01 USDC expressed as 10000 in 6-decimal precision), the payment network (base-sepolia), the USDC contract address on that network, and the peer's wallet address as the payment destination.

The x402 fetch wrapper in the requesting robot intercepts the 402 response. It reads the payment specification, constructs an EIP-3009 TransferWithAuthorization payload (which authorizes a gasless token transfer), signs the payload with the robot's private key using viem, and retries the original HTTP request with the signed payment authorization in the X-PAYMENT request header.

### Step 7: Payment Settlement

The peer's Express server receives the retried request containing the payment header. The x402 payment middleware extracts the signed authorization from the header and forwards it to the Coinbase CDP facilitator endpoint. The facilitator verifies the signature, submits the EIP-3009 transfer on-chain, and returns a settlement receipt containing the transaction hash. This entire process happens server-side in the peer's Express middleware before the request reaches the task handler function.

Once the middleware confirms settlement, the request reaches the task handler. The peer robot logs "PAYMENT_RECEIVED" with the sender address, amount, and transaction hash, then begins executing the sub-task.

### Step 8: Sub-Task Execution

The peer robot executes the sub-task. For the simulation, this means updating its target position in Redis (which triggers movement in the 3D scene), waiting for a simulated execution time, and returning a completion result to the delegating robot via HTTP response.

Before executing any sub-task that is marked as irreversible (e.g. placing a pallet, which would overwrite the current occupant of a zone), the robot performs a safety check. It queries the current state of the target zone from Redis. If the zone is occupied by another pallet, it aborts the sub-task, logs the abort reason, and returns a failure response to the delegating robot. If the zone is clear, it proceeds.

### Step 9: Reputation Update

When the delegating robot receives the completion response from the peer, it evaluates the result. If the sub-task completed successfully within the expected time window, it submits a positive reputation signal to the ERC-8004 Reputation Registry for the peer's token ID using viem's writeContract. If the sub-task failed or timed out, it submits a negative signal. Both outcomes are logged to agent_log.json with the resulting on-chain transaction hash.

### Step 10: Task Completion and Log Upload

Once all sub-tasks for a task are resolved, the robot composes a final task summary including the task ID, completion status, total execution time, list of peers used, total USDC paid out, and an array of all on-chain transaction hashes generated during the task. It appends this summary to agent_log.json.

It then uploads the completed agent_log.json to Storacha using the w3up client. Storacha returns a content-addressed CID for the uploaded log. The robot broadcasts this CID to the orchestrator via Redis, which forwards it to the frontend dashboard where it appears as a clickable link to the immutable log stored on the decentralized network.

The robot then immediately polls the task queue again for the next task.

---

## 8. Frontend Deep Dive

### 8.1 Technology Choices

**Three.js** is used for the 3D simulation rendering. It is the industry-standard JavaScript 3D library, runs entirely in the browser with no plugin requirements, and has a mature ecosystem of utilities including the CSS3DRenderer for HTML overlay labels and the GLTFLoader for importing 3D robot models if desired. The library's InstancedMesh API allows rendering many identical robot objects with a single GPU draw call, keeping frame rate stable even with many robots on screen.

**Yuka** is a standalone JavaScript game AI library designed specifically for autonomous agent simulation. It provides a Vehicle class with built-in steering behaviors (seek, arrive, flee, follow path), a finite state machine implementation for managing robot behavioral states, a navigation mesh system for pathfinding on walkable surfaces, and an entity manager that handles the update loop for all agents simultaneously. Yuka integrates cleanly with Three.js — its entity positions drive the Three.js mesh transforms each frame.

**React** is used only for the dashboard overlay, not the 3D scene. The dashboard is a set of React components rendered separately from the Three.js canvas and positioned alongside it using CSS. React is appropriate here because the dashboard is data-driven and frequently updating — React's reconciliation handles efficient DOM updates as the data streams in.

**Vite** serves as the development server and build tool. It provides near-instant hot module replacement during development, which matters when iterating on the simulation scene.

### 8.2 Scene Construction

The warehouse floor is a flat plane geometry with a grid shader material applied to it, creating visible cell boundaries. The dimensions are set to 20x20 grid cells with each cell being 2 world units — giving a total floor size of 40x40 world units. The camera is positioned above and angled to give a clear isometric view of the entire floor.

The four warehouse zones are built from flat rectangular plane geometries placed just above the floor plane to avoid z-fighting, each with a semi-transparent colored material. Zone labels are rendered as HTML div elements using the CSS3DRenderer, which keeps the labels as DOM elements that appear to exist in 3D space. This approach allows the labels to be easily styled with CSS and remain readable at any camera angle.

Each robot is represented by a BoxGeometry (0.8 x 0.8 x 0.8 world units) with a color-coded standard material. A small cone geometry is attached to the top face of each box, pointing forward, to give a clear visual indication of direction. The robots are low-polygon by design — this is a system demonstration, not a visual showcase. Simplicity in geometry keeps the focus on the behavioral and on-chain activity.

The pathfinding navmesh is built from the warehouse floor geometry using the three-pathfinding library. Zone boundaries and shelf obstacles are marked as non-walkable regions, so robots automatically route around them. When a robot receives a new target position from the WebSocket, three-pathfinding computes a path, and Yuka's PathFollowing steering behavior moves the robot along that path smoothly.

### 8.3 WebSocket State Management

The frontend maintains a single WebSocket connection to the orchestrator. All simulation state flows through this one connection. The frontend never makes direct API calls to the blockchain, to Redis, or to any robot agent process. This single connection design simplifies the frontend significantly and makes the backend fully responsible for all data.

Messages arriving on the WebSocket are typed by a `type` field. The frontend maintains a local state object for each robot, updated incrementally as messages arrive. Message types include: ROBOT_POSITION_UPDATE (drives Three.js mesh transform), ROBOT_STATE_CHANGE (drives robot visual state — idle, moving, executing), PAYMENT_EVENT (triggers particle effect between two robots), REPUTATION_UPDATE (updates dashboard and triggers floating indicator), TASK_ASSIGNED (updates dashboard robot card), TASK_COMPLETE (updates task counter), and LOG_ENTRY (appends to log feed in dashboard).

### 8.4 Dashboard Components

The **Robot Status Grid** shows five cards in a 2-3 layout. Each card shows the robot name, its capability type as a colored badge, its current task ID (or "IDLE"), its reputation score as both a number and a colored progress arc, and its current USDC balance. Cards pulse with a subtle animation when the robot transitions into an EXECUTING state.

The **Transaction Feed** is a virtualized scrolling list. Each row shows a relative timestamp, an icon indicating the transaction type (identity query, reputation read, payment, reputation write), a one-line description, and a shortened transaction hash with an external link icon. Rows are color-coded by type. New rows are added at the top with a slide-down animation. The list is virtualized (only DOM elements for visible rows exist at any time) to handle continuous operation without degrading performance.

The **Reputation Leaderboard** is a simple ranked list of the five robots updated in real time. Position changes are animated with smooth vertical transitions, so you can visually see a robot rise or fall in the rankings as its reputation changes.

The **Agent Log Feed** mirrors the agent_log.json entries being written by the backend, appearing as a streaming terminal-style output. Each entry shows the timestamp, robot ID, action type, and relevant data fields. When a log file is uploaded to Storacha and a CID is returned, the feed shows the CID as a clickable link.

---

## 9. Backend Deep Dive

### 9.1 Orchestrator Process

The orchestrator is the entry point for the entire backend system. When started, it performs the following initialization sequence: connects to the Redis instance, verifies all five robot agent processes have registered their endpoints in Redis (waiting up to 30 seconds for all to come online), initializes the WebSocket server on a fixed port, and seeds the task queue with the initial task set.

After initialization, the orchestrator does three things continuously. It subscribes to all robot Redis channels and forwards every message to the WebSocket broadcast function. It runs a task generator on a configurable interval (default: every 15 seconds) that adds new tasks to the queue if the queue depth falls below a threshold. It maintains a session statistics object that it broadcasts to the frontend every 5 seconds — total tasks completed, total USDC transferred across all robots, total on-chain transactions generated, and total reputation updates written.

The orchestrator does not restart robots that crash. In a production system it would, but for a hackathon demo, robots are expected to stay online for the duration.

### 9.2 Robot Agent Process

Each robot agent process follows a strict initialization sequence before entering the main loop. It loads its agent.json manifest file to get its name, capabilities, wallet private key path, and payment port. It initializes a viem wallet client using the private key. It loads its ERC-8004 token ID from the config — if no token ID exists (first run), it calls the registration function and saves the returned token ID. It starts its Express HTTP server with the x402 payment middleware on its designated port. It publishes its endpoint URL and capability list to Redis so peers can discover it. It writes its initial state (IDLE) to its Redis channel.

The main decision loop then begins. It is an infinite while loop with a 500ms minimum iteration time enforced by a sleep at the bottom of each iteration if the iteration completed faster.

Each iteration: blocking pop from Redis task queue with a 1-second timeout. If no task arrives, publish IDLE state and continue. If a task arrives, publish TASK_ACQUIRED state. Call Groq API with task and capability list — wait for structured sub-task array. For each sub-task: if own capability matches, execute it directly and log the action. If a peer is needed, run the peer selection flow (ERC-8004 query → reputation filter → peer selection → x402 payment → wait for response → reputation update). After all sub-tasks resolve, compose and write the task summary to agent_log.json, upload to Storacha, publish TASK_COMPLETE to Redis, and continue loop.

### 9.3 Inter-Process Communication Pattern

Robot processes never communicate directly with each other except through HTTP (x402 payment calls). All other coordination — knowing which robots are available, knowing what state peers are in — happens through Redis.

When Robot A needs to check whether Robot B is currently busy before delegating a task, it reads Robot B's last published state from a Redis key. This is a simple key-value read, not a network call to Robot B's process. Robot B publishes its state updates to Redis continuously, so Robot A always has a fresh (within 500ms) view of Robot B's availability.

This pattern means that if Robot B's process crashes, Robot A simply sees a stale state in Redis and will eventually time out trying to delegate to it. There is no direct dependency between robot processes — each one functions independently.

### 9.4 Task Decomposition via Groq

The Groq API call is made with a system prompt that instructs the model to act as a warehouse task planner, and a user message containing the task description and the robot's capability list. The system prompt specifies the exact JSON schema for the response — an array of sub-task objects each containing a sub-task ID, a description, the required capability, an estimated duration in seconds, and a boolean flag indicating whether the action is irreversible.

The model used is llama-3.1-8b-instant. This model is specifically chosen for its sub-200ms response time at Groq's inference speed. Using a larger model would add visible latency to the simulation. The task decomposition problem does not require reasoning depth — it requires structured output speed.

The response is parsed as JSON. If parsing fails (model returned malformed JSON), the robot falls back to a default decomposition based on simple string matching in the task description. This fallback ensures the simulation continues even if the LLM produces an unexpected response.

### 9.5 Safety and Guardrail System

Before executing any sub-task tagged as irreversible in the decomposed task array, the robot checks a set of pre-conditions stored in Redis. Pre-conditions are zone occupancy states, robot position states, and task lock states. A zone is considered locked if another robot has published a "ZONE_LOCKED" message for that zone within the last 10 seconds.

If any pre-condition fails, the robot sets the sub-task status to ABORTED, logs the abort with the specific pre-condition that failed, and checks whether a retry is possible. If the sub-task is retryable (e.g. zone is temporarily occupied), it adds the sub-task back to a local retry queue with a 5-second delay. If the sub-task is not retryable (e.g. the pallet no longer exists at the expected location), it marks the overall task as PARTIALLY_FAILED and continues to the remaining sub-tasks.

This guardrail system directly satisfies the "Safety and Guardrails" judging criterion in the Agent Only bounty, which specifically asks for validation before irreversible actions.

### 9.6 Compute Budget Enforcement

Each robot tracks its Groq API call count, its x402 payment count, and its Redis operation count per session. These metrics are included in the session statistics broadcast. There is a hard limit of 50 Groq API calls per robot per hour, enforced by a token bucket rate limiter. If a robot hits the limit, it falls back to the default decomposition method for the remainder of that hour.

This directly satisfies the "Compute Budget Awareness" criterion in the Agent Only bounty, which asks agents to operate within defined resource constraints.

---

## 10. Blockchain Layer Deep Dive

### 10.1 ERC-8004 Standard Overview

ERC-8004 is an Ethereum Improvement Proposal that defines a standard for trustless autonomous AI agents. It was co-authored by contributors from MetaMask, Ethereum Foundation, Google, and Coinbase. As of March 2026, the EIP is in Draft status but the contracts are deployed and operational.

The standard defines three separate on-chain registries:

**Identity Registry:** An ERC-721-based contract where each agent is minted a token representing its existence. The token metadata (stored on IPFS, referenced by a URI in the token) contains the agent's name, capability tags, operator wallet address, and endpoint URL. The contract exposes queryable functions to filter agents by capability tag. This is how Robot A finds all LIFTER-capable agents.

**Reputation Registry:** A separate contract where reputation scores are accumulated per agent token ID. Calling the recordSuccess function for a token ID increments its success counter. Calling recordFailure increments its failure counter. The getReputation function returns a score computed from the ratio of successes to total interactions, normalized to a 0-100 scale. Any address can record a reputation signal for any token ID — the design assumes social accountability, not permissioned writes. For the hackathon, this is intentional and acceptable.

**Validation Registry:** A third contract for attestations about agent capabilities from third parties. As of March 2026, this registry's contracts have not been deployed by the ERC-8004 maintainers. Deware does not use this registry — only the Identity and Reputation registries.

### 10.2 ERC-8004 Integration Mechanics

The Chitin Protocol provides the simplest integration path. Chitin is a thin service layer built on top of the ERC-8004 contracts that provides a registration API, handles IPFS metadata upload, and offers the first 10,000 agent registrations for free. Under the hood, Chitin calls the ERC-8004 Identity Registry contract's mint function.

Alternatively, the @agentic-trust/8004-ext-sdk provides direct TypeScript bindings to the registry contracts without going through Chitin, at the cost of more setup work (manual IPFS upload, direct contract interaction).

For Deware, the recommended approach is to use Chitin for the initial registration call and then interact with the registry contracts directly via viem for ongoing reads and reputation writes. This gives the fastest initial setup with the most control over ongoing interaction.

Network: Base Sepolia testnet. Gas is free via the Base Sepolia faucet. Contract addresses for the Identity Registry and Reputation Registry are deterministic CREATE2 addresses — the same across all chains where they are deployed.

### 10.3 x402 Payment Protocol Overview

x402 is an open protocol developed by Coinbase that revives the HTTP 402 "Payment Required" status code for automated stablecoin micropayments. It is the payment layer that enables machine-to-machine economic transactions over HTTP.

The protocol defines a simple three-party interaction: a client (the paying robot), a server (the receiving robot), and a facilitator (Coinbase CDP or another deployed facilitator service).

The server wraps any endpoint with x402 middleware. The middleware configuration specifies the required payment amount, the accepted token (USDC), the accepted network (Base Sepolia), and the server's receiving wallet address.

When a client sends a request to a protected endpoint without payment, the server returns HTTP 402 with a JSON body containing the payment specification. The client reads the specification, constructs an EIP-3009 TransferWithAuthorization message (which authorizes a specific transfer without requiring the client to submit a gas-paying transaction themselves), signs it with their private key, and retries the request with the signature in the X-PAYMENT header.

The server's middleware receives the retried request, extracts the signed authorization from the header, and sends it to the facilitator. The facilitator submits the EIP-3009 authorization to the USDC contract on-chain, which executes the token transfer from the client's address to the server's address. The facilitator returns a receipt containing the on-chain transaction hash. The middleware saves this receipt and allows the request to proceed to the handler function.

EIP-3009 is critical here because it makes the payment gasless from the client's perspective — the client only signs a message, the facilitator pays the gas for the actual on-chain token transfer. This is what makes sub-cent micropayments practical.

### 10.4 x402 Integration Mechanics

The @x402/express package provides the server-side middleware. Configuration requires the payment amount in the token's native decimal precision (USDC has 6 decimals, so 0.01 USDC is expressed as 10000), the USDC contract address on Base Sepolia, the server's receiving wallet address, and the facilitator URL.

The @x402/fetch package provides the client-side wrapper. It replaces the standard fetch function with a version that automatically handles 402 responses — extracting payment requirements, signing the authorization, and retrying.

The Coinbase CDP facilitator is free for the first 1,000 transactions per month, which is more than sufficient for a hackathon demo. The facilitator endpoint for Base Sepolia testnet is publicly documented in the x402 documentation.

### 10.5 On-Chain Transaction Volume in Demo

For a 30-minute demo, the expected on-chain transaction volume per robot:
- ERC-8004 identity registration: 1 transaction (one-time, done before demo)
- ERC-8004 reputation reads: these are read calls (no transaction, no gas)
- x402 payment settlements: approximately 8-15 per robot per 30 minutes (one per delegated sub-task)
- ERC-8004 reputation writes: approximately 8-15 per robot per 30 minutes (one per completed delegation)

Total expected on-chain transactions across all robots for a 30-minute demo: approximately 80-150. All on Base Sepolia testnet, all free.

---

## 11. Data Layer Deep Dive

### 11.1 Redis Schema

Redis is used for five distinct data patterns:

**Task Queue:** A Redis List called `tasks:queue`. The orchestrator pushes JSON task objects to the right of the list. Robots pop from the left using BLPOP (blocking left pop with timeout). This is the simplest reliable queue pattern in Redis.

**Robot State Store:** A Redis Hash called `robot:{robotId}:state` for each robot. Fields include current position (x, y, z), current task ID, behavioral state (IDLE/MOVING/EXECUTING/WAITING_PAYMENT), reputation score (cached), USDC balance (cached), and last-updated timestamp. The Hash is updated by each robot at the end of every decision loop iteration.

**Zone Lock Store:** A Redis key called `zone:{zoneId}:lock` with a TTL of 10 seconds. When a robot begins executing a task in a zone, it sets this key with its own robot ID as the value. The TTL ensures the lock expires automatically if the robot crashes without releasing it. Before a robot takes an irreversible action in a zone, it uses Redis SET with NX flag (set if not exists) to attempt acquiring the lock atomically.

**Session Statistics:** A Redis Hash called `session:stats`. Updated by robots and the orchestrator throughout the session. Contains cumulative counters for tasks completed, total USDC transferred, on-chain transaction count, and reputation updates written.

**Pub/Sub Channels:** One channel per robot, named `robot:{robotId}:events`. Robots publish event objects to their channel. The orchestrator subscribes to all channels using Redis pattern subscription and forwards events to WebSocket clients.

### 11.2 agent_log.json Schema

This file is required by both Ethereum Foundation bounties. It must contain structured execution logs showing decisions, tool calls, retries, failures, and final outputs.

The file has a top-level object with: agentId (string), erc8004TokenId (string), operatorWallet (address string), sessionStart (ISO timestamp), and an entries array.

Each entry in the array has: timestamp (ISO), action (enum string), and data (object with action-specific fields).

Action types and their data fields:
- TASK_RECEIVED: taskId, taskType, description
- TASK_DECOMPOSED: subTaskCount, subTasks array with required capabilities
- CAPABILITY_CHECK: subTaskId, requiredCapability, selfCapable (boolean)
- PEER_QUERY: capability, registryCallTxHash (for reads), candidateCount
- REPUTATION_CHECK: peerId, reputationScore, threshold, passed (boolean)
- PEER_SELECTED: peerId, reputationScore, selectionReason
- PAYMENT_INITIATED: to, amount, network, asset
- PAYMENT_RECEIVED: from, amount, txHash (facilitator settlement hash)
- SUBTASK_EXECUTING: subTaskId, description, zone
- SAFETY_CHECK: subTaskId, checkType, result, reason (if failed)
- SUBTASK_COMPLETE: subTaskId, durationMs, success
- SUBTASK_ABORTED: subTaskId, reason, retryScheduled
- REPUTATION_UPDATED: peerId, delta, txHash
- TASK_COMPLETE: taskId, totalDurationMs, peersUsed, totalUSDCPaid, txHashes
- LOG_UPLOADED: storachaCID, uploadDurationMs

### 11.3 agent.json Schema

This file is required by both Ethereum Foundation bounties as the "Agent Capability Manifest". It describes the agent's static properties and capabilities.

Fields: schemaVersion, agentName, agentType, operatorWallet, erc8004TokenId, erc8004IdentityRegistryAddress, supportedCapabilities (array of strings), supportedTechStacks (array of strings), computeConstraints object (maxConcurrentTasks, maxPaymentPerTaskUSDC, trustThreshold, groqCallsPerHour), supportedTaskCategories (array), paymentEndpoint (URL), paymentPort (integer), acceptedPaymentTokens (array), acceptedPaymentNetworks (array), reputationRegistryAddress, metadataURI (IPFS CID).

### 11.4 Storacha Integration

Storacha (formerly web3.storage) is used as the permanent, immutable storage layer for completed agent logs. It is a hot storage layer built on Filecoin, meaning uploaded content is immediately retrievable via HTTP gateway, not subject to Filecoin's sector commitment delays.

The w3up-client library (npm package @storacha/client) handles all interaction. The integration requires creating a Storacha Space (done once at setup), authorizing the robot's DID (Decentralized Identifier) to upload to that space, and then calling the uploadFile function with the log file as a Blob.

The upload returns a CID (Content Identifier) — a hash of the file content that also serves as its address on the IPFS-compatible network. This CID is deterministic — the same file content always produces the same CID. It is permanent — content stored on Storacha is backed by Filecoin storage deals and cannot be deleted. It is verifiable — anyone can download the file using the CID from any IPFS gateway and verify that the content matches the hash.

For multi-agent UCAN delegation (letting all five robots upload to the same Space without each having independent Space credentials), a single Space owner generates per-robot delegations scoped to upload-only capability. This is the UCAN (User Controlled Authorization Networks) model that Storacha uses for access control.

---

## 12. Agent Manifests Specification

### 12.1 agent.json — Full Field Specification

Required by ERC-8004 bounty and Agent Only bounty. One file per robot. Stored in agents/manifests/ directory. Also uploaded to IPFS and referenced in the ERC-8004 token metadata.

```
schemaVersion          String   "1.0" — version of this manifest schema
agentName              String   Human-readable name, e.g. "Deware-Scout-1"
agentType              String   "warehouse-simulation-agent"
operatorWallet         Address  The Ethereum address that owns/deployed this agent
erc8004TokenId         String   Token ID returned from ERC-8004 registration
erc8004Chain           String   "base-sepolia"
erc8004IdentityReg     Address  Identity Registry contract address
erc8004ReputationReg   Address  Reputation Registry contract address
capabilities           Array    ["NAVIGATE", "SCAN"] or ["LIFT"] or ["CARRY"]
techStacks             Array    ["nodejs", "viem", "x402", "erc-8004", "groq"]
computeConstraints     Object   
  maxConcurrentTasks   Integer  1 — robot handles one task at a time
  maxPaymentUSDC       String   "0.10" — max it will pay per sub-task
  trustThreshold       Integer  80 — minimum reputation score for peers
  groqCallsPerHour     Integer  50 — hard rate limit on LLM calls
taskCategories         Array    ["warehouse-navigation", "object-transport"]
paymentEndpoint        String   "http://localhost:3001" (or deployed URL)
paymentPort            Integer  3001 (unique per robot: 3001, 3002, 3003...)
acceptedTokens         Array    ["USDC"]
acceptedNetworks       Array    ["base-sepolia"]
metadataIPFSCID        String   CID of this file uploaded to IPFS
```

### 12.2 agent_log.json — Runtime Output

Required by Agent Only bounty and ERC-8004 bounty as proof of autonomous operation. Written continuously during execution. Uploaded to Storacha at the end of each completed task.

This file proves to judges that the agent operated autonomously — showing its full decision chain for every task including which peers it considered, why it selected the ones it did, that payments were made and settled on-chain, and that reputation was updated based on outcomes.

---

## 13. Complete Tech Stack

### Frontend

| Technology | Version | Purpose | Category |
|------------|---------|---------|----------|
| Three.js | r165 | 3D warehouse scene rendering | Simulation |
| Yuka | 0.9.0 | Autonomous agent steering + FSM + pathfinding | Simulation |
| three-pathfinding | 0.10.0 | NavMesh A* pathfinding on warehouse grid | Simulation |
| React | 18 | Dashboard UI components | Interface |
| React Three Fiber | 8 | React bindings for Three.js (optional) | Simulation |
| Vite | 5 | Development server + build tool | Tooling |
| TypeScript | 5 | Type safety across frontend | Tooling |

### Backend

| Technology | Version | Purpose | Category |
|------------|---------|---------|----------|
| Node.js | 20 LTS | Robot agent processes + orchestrator | Runtime |
| Express.js | 4 | HTTP server for x402 payment endpoints | Server |
| Redis | 7 | Task queue + real-time state + pub/sub | State |
| ioredis | 5 | Node.js Redis client | Client |
| ws | 8 | WebSocket server for frontend communication | Realtime |
| Groq SDK | latest | LLM task decomposition via llama-3.1-8b-instant | AI |
| pino | 8 | Structured JSON logging | Logging |
| dotenv | 16 | Environment variable management | Config |
| TypeScript | 5 | Type safety across backend | Tooling |

### Blockchain

| Technology | Version | Purpose | Category |
|------------|---------|---------|----------|
| viem | 2 | Ethereum client: wallet, signing, contract reads/writes | Web3 |
| ERC-8004 (Chitin SDK) | latest | Agent identity registration | Identity |
| @agentic-trust/8004-ext-sdk | latest | Direct ERC-8004 registry TypeScript bindings | Identity |
| @x402/express | latest | x402 payment middleware for robot HTTP servers | Payments |
| @x402/fetch | latest | x402 payment client for outbound robot payments | Payments |
| Base Sepolia | — | Testnet for all on-chain transactions | Network |
| Coinbase CDP | — | x402 facilitator service (free tier) | Facilitator |

### Storage

| Technology | Version | Purpose | Category |
|------------|---------|---------|----------|
| @storacha/client | 1.8+ | Upload agent logs to Storacha (w3up) | Storage |
| Pinata | — | IPFS pin for ERC-8004 agent card metadata | Storage |

### Dev Tools

| Tool | Purpose |
|------|---------|
| Hardhat | Solidity contract compilation and testing (if custom contracts needed) |
| Foundry | Fast contract testing alternative to Hardhat |
| Bruno | API client for testing robot payment endpoints (open source Postman alternative) |
| Base Sepolia Faucet | Get testnet ETH for gas |
| Circle USDC Faucet | Get testnet USDC for x402 payments |
| Basescan Sepolia | Block explorer for verifying on-chain transactions |
| Redis CLI | Direct Redis inspection during development |
| ngrok | Expose local robot payment endpoints to public URLs during development |

---

## 14. All Documentation References

### ERC-8004

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Official EIP specification | https://eips.ethereum.org/EIPS/eip-8004 | Full standard spec, interface definitions, registry function signatures |
| Chitin Protocol (registration service) | https://chitin.id/docs | Registration API, free tier limits, SDK usage, agent card schema |
| @agentic-trust/8004-ext-sdk GitHub | https://github.com/agentictrust/8004-ext-sdk | TypeScript SDK for direct registry interaction, examples |
| vistara-apps example repo | https://github.com/vistara-apps/erc-8004-example | Working multi-agent ERC-8004 example with CrewAI integration |
| ERC-8004 IQ.wiki overview | https://iq.wiki/wiki/erc-8004 | High-level explanation, deployed contract addresses by chain |
| QuillAudits ERC-8004 deep dive | https://www.quillaudits.com/blog/smart-contract/erc-8004 | Security considerations, registry interaction patterns |

### x402 Payment Protocol

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Official x402 documentation | https://docs.cdp.coinbase.com/x402/welcome | Complete protocol spec, SDK usage, facilitator setup |
| Coinbase x402 GitHub | https://github.com/coinbase/x402 | Source code, examples directory, TypeScript SDK packages |
| @x402/express npm | https://www.npmjs.com/package/@x402/express | Middleware installation and configuration options |
| x402 quickstart for sellers | https://docs.cdp.coinbase.com/x402/quickstart-for-sellers | Server-side setup: middleware config, payment endpoint creation |
| x402 quickstart for buyers | https://docs.cdp.coinbase.com/x402/quickstart-for-buyers | Client-side setup: x402/fetch usage, wallet integration |
| awesome-x402 resources list | https://github.com/xpaysh/awesome-x402 | Curated examples, tutorials, facilitator options |
| QuickNode x402 guide | https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required | Step-by-step integration tutorial |
| Coinbase CDP portal | https://portal.cdp.coinbase.com | Register for Coinbase CDP facilitator API key |

### Three.js + Simulation

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Three.js documentation | https://threejs.org/docs | Scene setup, geometry, materials, InstancedMesh, CSS3DRenderer |
| Three.js examples | https://threejs.org/examples | Robot/factory examples, instanced mesh demos |
| Yuka documentation | https://mugen87.github.io/yuka | Vehicle class, steering behaviors, FSM, NavMesh, entity manager |
| Yuka GitHub | https://github.com/Mugen87/yuka | Full source, examples folder with game AI demos |
| three-pathfinding GitHub | https://github.com/donmccurdy/three-pathfinding | NavMesh creation, pathfinding usage, Three.js integration |
| Multi-agent Three.js repo | https://github.com/damianoc90/Multi-Agent-web-simulation-based-on-AgentSimJs-ThreeJs | Reference implementation for multi-agent Three.js simulation |
| React Three Fiber docs | https://r3f.docs.pmnd.rs | React wrapper for Three.js (optional but accelerates UI integration) |

### Storacha

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Storacha documentation | https://docs.storacha.network | w3up client setup, Space creation, UCAN delegation |
| Quickstart guide | https://docs.storacha.network/quickstart | First upload in 5 minutes, authentication flow |
| How to upload | https://docs.storacha.network/how-to/upload | uploadFile API, content addressing, CID retrieval |
| w3up-client GitHub | https://github.com/storacha/w3up | Full source, README with delegation examples |
| Storacha console | https://console.storacha.network | Web UI for managing Spaces, viewing uploads, generating delegations |
| awesome-storacha | https://github.com/storacha/awesome-storacha | Example projects using Storacha |

### NEAR (optional — if time allows)

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| NEAR AI Agent Market | https://market.near.ai | Understanding Agent Market structure for possible integration |
| NEAR Intents documentation | https://docs.near.org/concepts/abstraction/intents | Intent submission, solver network, fulfillment flow |
| NEAR AI documentation | https://docs.near.ai | Agent registration, inference API, verifiable compute |
| Python agent example | https://github.com/near-examples/near-intents-agent-example | Reference implementation for NEAR agent with intents |

### viem (Ethereum client)

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| viem documentation | https://viem.sh/docs/getting-started | Wallet client setup, readContract, writeContract, account management |
| viem public client | https://viem.sh/docs/clients/public | Reading blockchain state without a signer |
| viem wallet client | https://viem.sh/docs/clients/wallet | Sending transactions, signing messages, contract writes |
| Base Sepolia chain config | https://viem.sh/docs/chains/base | Chain ID, RPC URLs, block explorer for viem config |

### Network Setup

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Base Sepolia faucet | https://www.coinbase.com/faucets/base-ethereum-goerli-faucet | Get testnet ETH for gas |
| Circle USDC testnet faucet | https://faucet.circle.com | Get testnet USDC for x402 payments — select Base Sepolia |
| Basescan Sepolia | https://sepolia.basescan.org | Verify on-chain transactions live during demo |
| Base Sepolia RPC | https://sepolia.base.org | Public RPC endpoint for viem client configuration |

### Groq

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Groq console | https://console.groq.com | API key generation, free tier limits |
| Groq API documentation | https://console.groq.com/docs/api-reference | Chat completion endpoint, model list, structured output |
| Groq TypeScript SDK | https://www.npmjs.com/package/groq-sdk | Installation, usage, streaming vs non-streaming |

### Redis

| Resource | URL | What to Look For |
|----------|-----|-----------------|
| Redis documentation | https://redis.io/docs | BLPOP for queue, Pub/Sub for events, Hash for state |
| ioredis GitHub | https://github.com/redis/ioredis | Node.js Redis client, connection setup, command reference |
| Redis BLPOP command | https://redis.io/commands/blpop | Blocking pop for task queue — exactly how robots receive tasks |
| Redis Pub/Sub guide | https://redis.io/docs/manual/pubsub | Pattern subscribe for orchestrator to listen to all robot channels |

---

## 15. Development Phases

### Phase 1 — Foundation (Day 1-2)

Objective: Get a single robot running the full loop, visible in a basic 3D scene.

Tasks:
- Set up Vite project with Three.js and basic warehouse scene (flat floor, four zones, one robot box)
- Set up Node.js orchestrator with Redis connection
- Build single robot agent process with basic decision loop (no blockchain yet — mock peers)
- Connect robot state to Three.js scene via WebSocket
- Confirm you can see the robot moving in the browser

Deliverable: One robot moving around a warehouse, picking up mock tasks, selecting mock peers, with a terminal log showing decisions.

### Phase 2 — Blockchain Integration (Day 3-4)

Objective: All five robots registered on ERC-8004, paying each other via x402.

Tasks:
- Write and run the registration script — get all five robots registered on Base Sepolia with ERC-8004
- Integrate x402/express into each robot's HTTP server
- Integrate x402/fetch into the peer payment flow
- Replace mock peer selection with real ERC-8004 registry queries
- Replace mock reputation values with real Reputation Registry reads
- Add real reputation writes after task completion
- Fund all five robot wallets with testnet USDC

Deliverable: All five robots visible in the browser, with a transaction feed on the dashboard showing real Base Sepolia transactions.

### Phase 3 — Polish + Storage (Day 5-6)

Objective: Complete the agent manifests, add Groq decomposition, upload logs to Storacha.

Tasks:
- Add Groq LLM integration for task decomposition
- Add agent.json manifests for all five robots
- Implement full agent_log.json structured logging
- Add Storacha upload at task completion — show CID in dashboard
- Add safety/guardrail system with zone locking
- Add compute budget tracking
- Add particle effects for payment events in Three.js scene
- Build reputation leaderboard in dashboard

Deliverable: Full demo flow working end-to-end, logs uploading to Storacha, dashboard showing all required information.

### Phase 4 — Demo Prep (Day 7)

Objective: Prepare the demo for submission and recording.

Tasks:
- Write the demo-reset script to restore simulation to clean state
- Record demo video: 5 minutes showing full flow from simulation start to completed tasks with on-chain evidence
- Write the GitHub README (this document)
- Verify all track compliance requirements are satisfied (see checklist below)
- Submit on DevSpot before March 31

---

## 16. Track Compliance Checklist

### AI & Robotics Track — Protocol Labs ($6,000)

- [ ] Simulation environment for testing multi-robot cooperation ✅ (core deliverable)
- [ ] Agent-to-agent communication ✅ (x402 HTTP between robots)
- [ ] Human-in-the-loop oversight is absent by design — agents are fully autonomous ✅
- [ ] Decentralized infrastructure integration ✅ (ERC-8004 on Base Sepolia, Storacha)
- [ ] Must qualify as submission to at least one sponsor challenge ✅ (ERC-8004 and Agent Only are sponsor challenges)

### Agents With Receipts — ERC-8004 ($4,004)

- [ ] ERC-8004 Identity Registry used ✅ (all five robots registered, registry queried for peer discovery)
- [ ] ERC-8004 Reputation Registry used ✅ (read before peer selection, written after task completion)
- [ ] Using multiple registries scores higher ✅ (both Identity and Reputation used)
- [ ] Autonomous agent architecture ✅ (full decision loops, no human intervention)
- [ ] ERC-8004 identity linked to operator wallet ✅ (each robot's token linked to its operator wallet in agent.json)
- [ ] Onchain verifiable transactions ✅ (all ERC-8004 writes produce tx hashes, visible on Basescan)
- [ ] agent.json manifest ✅
- [ ] agent_log.json ✅
- [ ] Multi-agent coordination is encouraged ✅ (five robots coordinating)

### Agent Only: Let The Agent Cook ($4,000)

- [ ] Autonomous execution: full discover → plan → execute → verify → submit loop ✅
- [ ] Minimal human involvement after launch ✅ (zero after simulation start)
- [ ] Task decomposition ✅ (Groq LLM decomposes tasks into sub-tasks)
- [ ] Autonomous decision making ✅ (peer selection, payment initiation, reputation updates)
- [ ] Self-correction when errors occur ✅ (retry queue for failed sub-tasks)
- [ ] Agent Identity: ERC-8004 registration ✅
- [ ] Operator wallet linked ✅
- [ ] ERC-8004 registration transaction ✅
- [ ] Agent Capability Manifest (agent.json) ✅
- [ ] Structured Execution Logs (agent_log.json) ✅
- [ ] Tool Use: multi-tool orchestration ✅ (Groq API, ERC-8004 contracts, x402 HTTP, Redis, Storacha)
- [ ] Safety and Guardrails ✅ (zone locking, pre-condition validation before irreversible actions)
- [ ] Compute Budget Awareness ✅ (Groq call rate limiting, tracked and reported)
- [ ] ERC-8004 Trust Integration (bonus) ✅ (selecting collaborators based on reputation)

---

## 17. Known Risks & Mitigations

### Risk 1: Lit Protocol / Vincent network transition
Not applicable — Deware does not use Lit Protocol or Vincent. This risk was deliberately avoided.

### Risk 2: ERC-8004 SDK documentation quality
The multiple available SDKs (Chitin, @agentic-trust/8004-ext-sdk) have varying documentation quality. Mitigation: Use Chitin for registration only. Use viem directly for all ongoing reads and writes to the registry contracts — viem requires ABI and contract address, which are stable and available from the EIP specification.

### Risk 3: x402 facilitator rate limits
Coinbase CDP free tier provides 1,000 transactions per month. A 30-minute demo with 5 robots will generate approximately 80-150 transactions. Mitigation: Well within limits. No action required.

### Risk 4: Storacha UCAN delegation complexity
Multi-agent upload to a single Storacha Space requires UCAN delegation setup. Mitigation: Create one Space per robot instead of one shared Space. This increases the number of Storacha accounts required but eliminates the UCAN delegation complexity entirely.

### Risk 5: Groq API latency affecting simulation feel
If Groq responses take longer than expected, robots will appear to pause before acting. Mitigation: Pre-compute task decompositions for the demo task set and cache them. The LLM call becomes a cache lookup in most cases, with live LLM calls only for task types not in the cache.

### Risk 6: Base Sepolia RPC congestion
Public RPC endpoints sometimes experience congestion during high-traffic periods. Mitigation: Use Alchemy or QuickNode's free Base Sepolia endpoint instead of the public RPC. Both have higher rate limits and better reliability.

### Risk 7: Demo reset complexity
If the demo needs to be run multiple times (for video recording retakes), reputation scores will be non-zero from previous runs, making the reputation selection logic less visually interesting. Mitigation: The demo-reset script re-registers fresh robot identities with new token IDs, effectively starting reputation history from zero. This takes approximately 2 minutes to run.

---

## Project Name

**Deware**

Tagline: *Autonomous robots. Verified trust. Machine payments. No humans required.*

---

*Built for PL Genesis: Frontiers of Collaboration Hackathon — March 2026*
*Tracks: AI & Robotics · ERC-8004 Agents With Receipts · Agent Only: Let The Agent Cook*
