import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import pino from 'pino';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createRedisClient } from '../shared/redis/client.js';
import { setRobotState } from '../shared/redis/robotState.js';
import { popTask } from '../shared/redis/taskQueue.js';
import { publishEvent } from '../shared/redis/pubsub.js';
import { AgentLogger } from './agentLog.js';
import type { RobotId, RobotState, Task } from '../shared/types/index.js';

// ── Load manifest ──────────────────────────────────────────────────────────────
const robotId = (process.env.ROBOT_ID ?? 'scout-1') as RobotId;
const manifestPath = path.resolve(`agents/manifests/${robotId}.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const log = pino({ level: 'info' }).child({ robotId });
const agentLog = new AgentLogger(robotId);

// ── Init wallet client ─────────────────────────────────────────────────────────
const rawKey = process.env[manifest.privateKeyEnv as string] ?? '';
const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC_URL),
});

// ── Redis ──────────────────────────────────────────────────────────────────────
const redis = createRedisClient();

// ── Robot state ────────────────────────────────────────────────────────────────
let state: RobotState = {
  robotId,
  position: { x: 0, y: 0, z: 0 },
  currentTaskId: null,
  behaviorState: 'IDLE',
  reputationScore: 100,
  usdcBalance: '0',
  lastUpdated: Date.now(),
};

async function updateState(patch: Partial<RobotState>): Promise<void> {
  state = { ...state, ...patch, lastUpdated: Date.now() };
  await setRobotState(redis, state);
  await publishEvent(redis, {
    robotId,
    type: 'STATE_CHANGED',
    state: state.behaviorState,
    ...(state.currentTaskId ? { taskId: state.currentTaskId } : {}),
    timestamp: Date.now(),
  });
}

// ── Express health check ───────────────────────────────────────────────────────
function startHttpServer(): void {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({
      agentId: robotId,
      name: manifest.name,
      capabilities: manifest.capabilities,
      state: state.behaviorState,
      currentTaskId: state.currentTaskId,
      walletAddress: account.address,
    });
  });

  app.listen(manifest.payment.port, () => {
    log.info({ port: manifest.payment.port }, 'HTTP server listening');
  });
}

// ── Register in Redis ──────────────────────────────────────────────────────────
async function registerAgent(): Promise<void> {
  await redis.hset(`robot:${robotId}:config`, {
    endpoint: manifest.payment.endpoint,
    capabilities: manifest.capabilities.join(','),
    walletAddress: account.address,
    registeredAt: Date.now(),
  });
  log.info({ endpoint: manifest.payment.endpoint }, 'Registered in Redis');
}

// ── Main decision loop ─────────────────────────────────────────────────────────
async function runLoop(): Promise<void> {
  log.info('Starting decision loop...');

  while (true) {
    const iterationStart = Date.now();

    try {
      // Poll for a task (1s timeout)
      const task: Task | null = await popTask(redis, 1);

      if (!task) {
        // Nothing in queue — stay IDLE
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
      } else {
        // Task acquired
        log.info({ taskId: task.taskId, description: task.description }, 'Task acquired');
        agentLog.append('TASK_RECEIVED', { taskId: task.taskId, description: task.description, priority: task.priority });

        await updateState({ behaviorState: 'EXECUTING', currentTaskId: task.taskId });

        // Simulate work
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));

        // Complete task
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
        await redis.hincrby('session:stats', 'tasksCompleted', 1);

        log.info({ taskId: task.taskId }, 'Task complete');
        agentLog.append('TASK_COMPLETE', { taskId: task.taskId });

        await publishEvent(redis, {
          robotId,
          type: 'TASK_COMPLETED',
          state: 'IDLE',
          taskId: task.taskId,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      log.error({ err }, 'Loop error');
      agentLog.append('ERROR', { message: (err as Error).message });
    }

    // Enforce 500ms minimum cycle time
    const elapsed = Date.now() - iterationStart;
    if (elapsed < 500) {
      await new Promise((r) => setTimeout(r, 500 - elapsed));
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  log.info({ name: manifest.name, capabilities: manifest.capabilities }, 'Robot starting...');

  await redis.connect();
  startHttpServer();
  await registerAgent();
  await updateState({ behaviorState: 'IDLE' });

  // Publish ROBOT_ONLINE event
  await publishEvent(redis, {
    robotId,
    type: 'STATE_CHANGED',
    state: 'IDLE',
    payload: {
      event: 'ROBOT_ONLINE',
      name: manifest.name,
      capabilities: manifest.capabilities,
      walletAddress: account.address,
    },
    timestamp: Date.now(),
  });

  agentLog.append('ROBOT_ONLINE', {
    name: manifest.name,
    capabilities: manifest.capabilities,
    walletAddress: account.address,
  });

  log.info('Robot online');

  await runLoop();
}

main().catch((err) => {
  log.error({ err }, 'Robot crashed');
  process.exit(1);
});