import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { createRedisClient } from '../shared/redis/client.js';
import { initialTasks } from './tasks.config.js';
import { spawnRobot } from '../spawner/index.js';
import type { WsMessage, WsSessionStats, WsRobotSpawned } from '../shared/types/index.js';
import { STATIC_ROBOT_IDS } from '../shared/types/index.js';

const log = pino({ level: 'info' });

const WS_PORT = 8080;
const API_PORT = 3000;
const ROBOT_POLL_TIMEOUT_MS = 30_000;
const ROBOT_POLL_INTERVAL_MS = 2_000;
const TASK_REFILL_INTERVAL_MS = 15_000;
const STATS_BROADCAST_INTERVAL_MS = 5_000;
const TASK_REFILL_THRESHOLD = 3;

// ── Redis clients ──────────────────────────────────────────────────────────────
const redis = createRedisClient();
const redisSub = createRedisClient(); // separate client for subscriptions

// ── Active robot registry — grows as robots spawn ────────────────────────────
const activeRobots = new Set<string>(STATIC_ROBOT_IDS);

// ── WebSocket server ───────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT });

function broadcast(message: WsMessage): void {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Step 1: Connect Redis ──────────────────────────────────────────────────────
async function connectRedis(): Promise<void> {
  await redis.connect();
  await redisSub.connect();
  await redis.ping();
  log.info('Redis connected');
}

// ── Step 2: Init WebSocket server ─────────────────────────────────────────────
function initWebSocket(): void {
  wss.on('connection', (ws) => {
    log.info('Frontend client connected');
    ws.on('close', () => log.info('Frontend client disconnected'));
  });
  log.info({ port: WS_PORT }, 'WebSocket server listening');
}

// ── Step 3: Wait for static robots to register ────────────────────────────────
async function waitForRobots(): Promise<void> {
  log.info({ count: activeRobots.size }, 'Waiting for robots to register...');
  const deadline = Date.now() + ROBOT_POLL_TIMEOUT_MS;
  const ids = [...activeRobots];

  while (Date.now() < deadline) {
    const results = await Promise.all(
      ids.map((id) => redis.exists(`robot:${id}:state`))
    );
    const onlineCount = results.filter(Boolean).length;

    if (onlineCount === ids.length) {
      log.info({ count: ids.length }, 'All robots online');
      return;
    }

    log.info({ onlineCount, total: ids.length }, 'Robots not yet ready, polling...');
    await new Promise((r) => setTimeout(r, ROBOT_POLL_INTERVAL_MS));
  }

  log.warn('Not all robots came online within 30s — continuing anyway');
}

// ── Step 4: Seed task queue ────────────────────────────────────────────────────
async function seedTaskQueue(): Promise<void> {
  const existing = await redis.llen('tasks:queue');
  if (existing > 0) {
    log.info({ existing }, 'Task queue already has tasks, skipping seed');
    return;
  }

  const serialized = initialTasks.map((t) => JSON.stringify({ ...t, createdAt: Date.now() }));
  await redis.rpush('tasks:queue', ...serialized);
  log.info({ count: initialTasks.length }, 'Task queue seeded');
}

// ── Continuous Job 1: Pub/Sub forwarder ───────────────────────────────────────
async function startPubSubForwarder(): Promise<void> {
  const subscribe = () => redisSub.psubscribe('robot:*:events');

  await subscribe();

  // Re-subscribe after reconnection — ioredis drops subscriptions on disconnect
  redisSub.on('ready', () => {
    log.info('Redis subscriber reconnected — re-subscribing to robot:*:events');
    subscribe().catch((err) => log.error({ err }, 'Re-subscribe failed'));
  });

  redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    try {
      const event = JSON.parse(message);
      broadcast(event as WsMessage);
      log.debug({ channel }, 'Forwarded event to WebSocket clients');
    } catch {
      log.warn({ channel, message }, 'Failed to parse robot event');
    }
  });

  log.info('Pub/Sub forwarder started — subscribed to robot:*:events');
}

// ── Continuous Job 2: Task refill generator ────────────────────────────────────
function startTaskGenerator(): void {
  let counter = initialTasks.length + 1;

  setInterval(async () => {
    try {
      const queueLength = await redis.llen('tasks:queue');
      if (queueLength >= TASK_REFILL_THRESHOLD) return;

      const needed = TASK_REFILL_THRESHOLD - queueLength + 2;
      const zones = ['INTAKE', 'STORAGE', 'PROCESSING', 'PACKAGING', 'DISPATCH'] as const;
      const priorities = ['low', 'normal', 'high', 'urgent'] as const;

      for (let i = 0; i < needed; i++) {
        const srcIndex = Math.floor(Math.random() * zones.length);
        const src = zones[srcIndex];
        let dstIndex = Math.floor(Math.random() * zones.length);
        if (dstIndex === srcIndex) dstIndex = (srcIndex + 1) % zones.length;
        const dst = zones[dstIndex];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];

        const task = {
          taskId: `task-${String(counter++).padStart(3, '0')}`,
          description: `Move goods from ${src} to ${dst}`,
          sourceZone: src,
          destinationZone: dst,
          priority,
          createdAt: Date.now(),
        };

        await redis.rpush('tasks:queue', JSON.stringify(task));
        log.info({ taskId: task.taskId }, 'Generated new task');
      }
    } catch (err) {
      log.error({ err }, 'Task generator error');
    }
  }, TASK_REFILL_INTERVAL_MS);

  log.info({ intervalMs: TASK_REFILL_INTERVAL_MS }, 'Task generator started');
}

// ── Continuous Job 3: Stats broadcaster ──────────────────────────────────────
function startStatsBroadcaster(): void {
  setInterval(async () => {
    try {
      const raw = await redis.hgetall('session:stats');
      if (!raw || Object.keys(raw).length === 0) return;

      const message: WsSessionStats = {
        type: 'SESSION_STATS',
        stats: {
          tasksCompleted: parseInt(raw.tasksCompleted ?? '0', 10),
          totalUsdcTransferred: raw.totalUsdcTransferred ?? '0',
          onChainTransactionCount: parseInt(raw.onChainTransactionCount ?? '0', 10),
          reputationUpdatesWritten: parseInt(raw.reputationUpdatesWritten ?? '0', 10),
        },
        timestamp: Date.now(),
      };

      broadcast(message);
    } catch (err) {
      log.error({ err }, 'Stats broadcaster error');
    }
  }, STATS_BROADCAST_INTERVAL_MS);

  log.info({ intervalMs: STATS_BROADCAST_INTERVAL_MS }, 'Stats broadcaster started');
}

// ── REST API for dynamic robot spawning ───────────────────────────────────────
function startApiServer(): void {
  const app = express();
  app.use(express.json());

  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  /**
   * GET /api/robots
   * Returns all registered robot states from Redis
   */
  app.get('/api/robots', async (req, res) => {
    try {
      const robotIds = [...activeRobots];
      const states = await Promise.all(
        robotIds.map(async (robotId) => {
          const raw = await redis.hgetall(`robot:${robotId}:state`);
          if (!raw || Object.keys(raw).length === 0) return null;

          let capabilities: string[] = [];
          try {
            capabilities = raw.capabilities ? JSON.parse(raw.capabilities) : [];
          } catch {
            capabilities = [];
          }

          return {
            robotId,
            position: {
              x: parseFloat(raw.positionX ?? '0'),
              y: parseFloat(raw.positionY ?? '0'),
              z: parseFloat(raw.positionZ ?? '0'),
            },
            currentTaskId: raw.currentTaskId || null,
            behaviorState: raw.behaviorState || 'IDLE',
            reputationScore: parseInt(raw.reputationScore ?? '85', 10),
            usdcBalance: raw.usdcBalance || '0',
            lastUpdated: parseInt(raw.lastUpdated ?? '0', 10),
            capabilities,
          };
        })
      );

      const validStates = states.filter((s) => s !== null);
      res.json(validStates);
    } catch (err) {
      log.error({ err }, 'Failed to fetch robot states');
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * GET /api/robot/:robotId/state
   * Returns a single robot's state
   */
  app.get('/api/robot/:robotId/state', async (req, res) => {
    try {
      const { robotId } = req.params;
      const raw = await redis.hgetall(`robot:${robotId}:state`);

      if (!raw || Object.keys(raw).length === 0) {
        res.status(404).json({ error: 'Robot not found' });
        return;
      }

      let capabilities: string[] = [];
      try {
        capabilities = raw.capabilities ? JSON.parse(raw.capabilities) : [];
      } catch {
        capabilities = [];
      }

      const state = {
        robotId,
        position: {
          x: parseFloat(raw.positionX ?? '0'),
          y: parseFloat(raw.positionY ?? '0'),
          z: parseFloat(raw.positionZ ?? '0'),
        },
        currentTaskId: raw.currentTaskId || null,
        behaviorState: raw.behaviorState || 'IDLE',
        reputationScore: parseInt(raw.reputationScore ?? '85', 10),
        usdcBalance: raw.usdcBalance || '0',
        lastUpdated: parseInt(raw.lastUpdated ?? '0', 10),
        capabilities,
      };

      res.json(state);
    } catch (err) {
      log.error({ err }, 'Failed to fetch robot state');
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/task
   * Body: { description, sourceZone, destinationZone, priority, assignedTo? }
   * Creates a new task and adds it to the queue
   */
  app.post('/api/task', async (req, res) => {
    const { description, sourceZone, destinationZone, priority, assignedTo } = req.body as {
      description?: string;
      sourceZone?: string;
      destinationZone?: string;
      priority?: string;
      assignedTo?: string;
    };

    if (!description || !sourceZone || !destinationZone || !priority) {
      res.status(400).json({
        error: 'Missing required fields: description, sourceZone, destinationZone, priority',
      });
      return;
    }

    const validZones = ['INTAKE', 'STORAGE', 'SORTING', 'STAGING', 'DISPATCH', 'CHARGING'];
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    if (!validZones.includes(sourceZone) || !validZones.includes(destinationZone)) {
      res.status(400).json({ error: 'Invalid zone. Valid zones: ' + validZones.join(', ') });
      return;
    }

    if (!validPriorities.includes(priority)) {
      res.status(400).json({
        error: 'Invalid priority. Valid priorities: ' + validPriorities.join(', '),
      });
      return;
    }

    try {
      // Generate task ID
      const queueLength = await redis.llen('tasks:queue');
      const taskId = `task-${String(queueLength + 1).padStart(3, '0')}`;

      const task = {
        taskId,
        description,
        sourceZone,
        destinationZone,
        priority,
        assignedTo: assignedTo || undefined,
        createdAt: Date.now(),
      };

      // Add to Redis queue
      await redis.rpush('tasks:queue', JSON.stringify(task));

      log.info({ taskId, description }, 'Task created via API');
      res.status(201).json({ success: true, taskId, task });
    } catch (err) {
      log.error({ err }, 'Failed to create task');
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /**
   * POST /api/spawn-robot
   * Body: { capabilities: string[], name?: string }
   * Returns the new robot's metadata once it is fully online (~10–20s).
   */
  app.post('/api/spawn-robot', async (req, res) => {
    const { capabilities, name } = req.body as {
      capabilities?: string[];
      name?: string;
    };

    if (!Array.isArray(capabilities) || capabilities.length === 0) {
      res.status(400).json({ error: 'capabilities must be a non-empty array' });
      return;
    }

    const valid = ['NAVIGATE', 'SCAN', 'LIFT', 'CARRY'];
    const invalid = capabilities.filter((c) => !valid.includes(c));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Unknown capabilities: ${invalid.join(', ')}` });
      return;
    }

    log.info({ capabilities, name }, 'Spawn robot request received');

    try {
      const result = await spawnRobot(redis, capabilities, name);

      // Track in active robot set
      activeRobots.add(result.robotId);

      // Broadcast to frontend
      const message: WsRobotSpawned = {
        type: 'ROBOT_SPAWNED',
        robotId: result.robotId,
        name: result.name,
        capabilities: result.capabilities,
        walletAddress: result.walletAddress,
        tokenId: result.tokenId,
        reputationScore: 85, // bootstrap trust (same as peerSelector default for new agents)
        usdcBalance: result.usdcBalance,
        port: result.port,
        endpoint: result.endpoint,
        timestamp: Date.now(),
      };
      broadcast(message);

      log.info({ robotId: result.robotId }, 'Robot spawned and broadcast sent');
      res.status(201).json(result);
    } catch (err) {
      log.error({ err }, 'Failed to spawn robot');
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.listen(API_PORT, () => {
    log.info({ port: API_PORT }, 'Orchestrator API server listening');
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log.info('Orchestrator starting...');

  await connectRedis();
  initWebSocket();
  await waitForRobots();
  await seedTaskQueue();
  await startPubSubForwarder();
  startTaskGenerator();
  startStatsBroadcaster();
  startApiServer();

  log.info('Orchestrator fully initialized');

  process.on('SIGINT', async () => {
    log.info('Shutting down...');
    await redis.quit();
    await redisSub.quit();
    wss.close();
    process.exit(0);
  });
}

main().catch((err) => {
  log.error({ err }, 'Orchestrator crashed');
  process.exit(1);
});