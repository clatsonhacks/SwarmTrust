import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { createRedisClient } from '../shared/redis/client.js';
import { initialTasks } from './tasks.config.js';
import type { WsMessage, WsSessionStats, RobotId } from '../shared/types/index.js';

const log = pino({ level: 'info' });

const WS_PORT = 8080;
const ROBOT_IDS: RobotId[] = ['scout-1', 'lifter-2', 'carrier-3', 'inspector-4', 'dispatcher-5'];
const ROBOT_POLL_TIMEOUT_MS = 30_000;
const ROBOT_POLL_INTERVAL_MS = 2_000;
const TASK_REFILL_INTERVAL_MS = 15_000;
const STATS_BROADCAST_INTERVAL_MS = 5_000;
const TASK_REFILL_THRESHOLD = 3;

// ── Redis clients ──────────────────────────────────────────────────────────────
const redis = createRedisClient();
const redisSub = createRedisClient(); // separate client for subscriptions

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

// ── Step 3: Wait for robots to register ───────────────────────────────────────
async function waitForRobots(): Promise<void> {
  log.info('Waiting for robots to register...');
  const deadline = Date.now() + ROBOT_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const results = await Promise.all(
      ROBOT_IDS.map((id) => redis.exists(`robot:${id}:state`))
    );
    const onlineCount = results.filter(Boolean).length;

    if (onlineCount === ROBOT_IDS.length) {
      log.info('All 5 robots online');
      return;
    }

    log.info({ onlineCount, total: ROBOT_IDS.length }, 'Robots not yet ready, polling...');
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