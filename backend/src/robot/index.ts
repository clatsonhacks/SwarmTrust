import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import pino from 'pino';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import { createRedisClient } from '../shared/redis/client.js';
import { setRobotState } from '../shared/redis/robotState.js';
import { popTask } from '../shared/redis/taskQueue.js';
import { publishEvent } from '../shared/redis/pubsub.js';
import { AgentLogger } from './agentLog.js';
import { TaskDecomposer } from './decomposer.js';
import { selectPeer } from './peerSelector.js';
import { giveFeedback } from '../shared/blockchain/contracts.js';
import { makeX402Fetch } from '../shared/x402/client.js';
import type { RobotId, RobotState, Task } from '../shared/types/index.js';

// ── Load manifest ──────────────────────────────────────────────────────────────
const robotId = (process.env.ROBOT_ID ?? 'scout-1') as RobotId;
const manifestPath = path.resolve(`agents/manifests/${robotId}.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const log = pino({ level: 'info' }).child({ robotId });
const agentLog = new AgentLogger(robotId);
const decomposer = new TaskDecomposer(
  process.env.GROQ_API_KEY ?? '',
  manifest.compute.maxGroqCallsPerHour as number
);

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

// ── x402 resource server (shared across all routes on this robot) ──────────────
const resourceServer = registerExactEvmScheme(new x402ResourceServer());

// ── Express server with x402-protected /task endpoint ─────────────────────────
function startHttpServer(): void {
  const app = express();
  app.use(express.json());

  // Health check — free, no payment required
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

  // Paid task delegation endpoint — requires 0.001 USDC per call
  app.use(
    paymentMiddleware(
      {
        'POST /task': {
          accepts: {
            scheme: 'exact',
            network: 'eip155:84532',
            payTo: account.address,
            price: '$0.001',
          },
          description: `Delegate a subtask to ${manifest.name}`,
        },
      },
      resourceServer,
      { testnet: true }
    )
  );

  app.post('/task', async (req, res) => {
    const { subTaskId, description, requiredCapability, estimatedDurationSecs } = req.body as {
      subTaskId: string;
      description: string;
      requiredCapability: string;
      estimatedDurationSecs: number;
    };

    log.info({ subTaskId, requiredCapability }, 'Delegated subtask received');
    agentLog.append('SUBTASK_EXECUTING', { subTaskId, description, delegated: true });

    const behaviorState = requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
    await updateState({ behaviorState });

    // Simulate execution (scaled: 1 real sec = 100ms sim)
    await new Promise((r) => setTimeout(r, (estimatedDurationSecs ?? 2) * 100));

    await updateState({ behaviorState: 'IDLE', currentTaskId: null });
    log.info({ subTaskId }, 'Delegated subtask complete');

    res.json({ success: true, subTaskId, completedAt: Date.now() });
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

        // ── Decompose via Groq ──────────────────────────────────────────────
        const { subtasks, fromCache, fromFallback, groqCallsRemaining } = await decomposer.decompose(
          task.taskId,
          task.description,
          manifest.capabilities as string[]
        );

        log.info({ taskId: task.taskId, subTaskCount: subtasks.length, fromCache, fromFallback, groqCallsRemaining }, 'Task decomposed');
        agentLog.append('TASK_DECOMPOSED', {
          taskId: task.taskId,
          subTaskCount: subtasks.length,
          fromCache,
          fromFallback,
          groqCallsRemaining,
          subtasks,
        });

        // ── Execute sub-tasks ───────────────────────────────────────────────
        for (const subtask of subtasks) {
          const canDo = (manifest.capabilities as string[]).includes(subtask.requiredCapability);

          log.info(
            { subTaskId: subtask.subTaskId, requiredCapability: subtask.requiredCapability, canDo },
            canDo ? 'Executing sub-task myself' : 'Sub-task needs peer delegation'
          );
          agentLog.append('CAPABILITY_CHECK', {
            subTaskId: subtask.subTaskId,
            description: subtask.description,
            requiredCapability: subtask.requiredCapability,
            canDo,
            action: canDo ? 'SELF_EXECUTE' : 'NEEDS_PEER',
          });

          if (canDo) {
            agentLog.append('SUBTASK_EXECUTING', { subTaskId: subtask.subTaskId, description: subtask.description });
            const behaviorState = subtask.requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
            await updateState({ behaviorState, currentTaskId: task.taskId });
            await new Promise((r) => setTimeout(r, subtask.estimatedDurationSecs * 100));
          } else {
            // ── Peer delegation via x402 ──────────────────────────────────────
            const peer = await selectPeer(
              redis, log, agentLog, robotId,
              subtask.requiredCapability as import('./decomposer.js').Capability,
              manifest.compute.trustThreshold as number
            );

            if (peer) {
              try {
                await updateState({ behaviorState: 'WAITING', currentTaskId: task.taskId });
                const x402Fetch = makeX402Fetch(account);

                const res = await x402Fetch(`${peer.endpoint}/task`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    subTaskId: subtask.subTaskId,
                    description: subtask.description,
                    requiredCapability: subtask.requiredCapability,
                    estimatedDurationSecs: subtask.estimatedDurationSecs,
                  }),
                });

                if (res.ok) {
                  const paymentResponse = res.headers.get('PAYMENT-RESPONSE');
                  agentLog.append('SUBTASK_EXECUTING', {
                    subTaskId: subtask.subTaskId,
                    delegatedTo: peer.agentId,
                    paymentTx: paymentResponse ?? undefined,
                  });
                  log.info({ subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Delegation succeeded, giving feedback');

                  // Post-delegation on-chain feedback (positive)
                  await giveFeedback(account, peer.tokenId, 80, peer.endpoint);
                } else {
                  log.warn({ subTaskId: subtask.subTaskId, status: res.status }, 'Peer returned error');
                  agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: `peer HTTP ${res.status}` });
                }
              } catch (err) {
                log.error({ err, subTaskId: subtask.subTaskId }, 'Delegation failed');
                agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: (err as Error).message });
              }
            }
          }
        }

        // Complete task
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
        await redis.hincrby('session:stats', 'tasksCompleted', 1);

        log.info({ taskId: task.taskId }, 'Task complete');
        agentLog.append('TASK_COMPLETE', { taskId: task.taskId, subTaskCount: subtasks.length, groqCallsUsed: decomposer.getCallCount() });

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