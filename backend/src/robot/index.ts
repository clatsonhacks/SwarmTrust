import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import express from 'express';
import pino from 'pino';
import { privateKeyToAccount } from 'viem/accounts';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import { createRedisClient } from '../shared/redis/client.js';
import { setRobotState } from '../shared/redis/robotState.js';
import { popTask } from '../shared/redis/taskQueue.js';
import { publishEvent } from '../shared/redis/pubsub.js';
import { AgentLogger } from './agentLog.js';
import { TaskDecomposer } from './decomposer.js';
import { selectPeers } from './peerSelector.js';
import { giveFeedback, getUsdcBalance, USDC_ADDRESS } from '../shared/blockchain/contracts.js';
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

// ── Zone positions for position simulation ─────────────────────────────────────
const ZONE_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
  INTAKE:     { x: 0,   y: 0,  z: 0 },
  STORAGE:    { x: 10,  y: 0,  z: 0 },
  PROCESSING: { x: 10,  y: 10, z: 0 },
  PACKAGING:  { x: 0,   y: 10, z: 0 },
  DISPATCH:   { x: -10, y: 5,  z: 0 },
};

// ── Init wallet client ─────────────────────────────────────────────────────────
const rawKey = process.env[manifest.privateKeyEnv as string] ?? '';
const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);

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

// ── Busy flag — prevents double-booking between queue loop and inbound delegations
let isBusy = false;

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

// Log PAYMENT_RECEIVED + increment USDC balance after every settled payment
resourceServer.onAfterSettle(async (ctx) => {
  const amountUsdc = (Number(ctx.requirements.amount) / 1e6).toFixed(6);
  agentLog.append('PAYMENT_RECEIVED', {
    payer: ctx.result.payer ?? 'unknown',
    amount: amountUsdc,
    asset: 'USDC',
    assetAddress: USDC_ADDRESS,
    network: ctx.result.network,
    txHash: ctx.result.transaction,
  });
  log.info({ payer: ctx.result.payer, amount: amountUsdc, txHash: ctx.result.transaction }, 'Payment received');
  state.usdcBalance = (parseFloat(state.usdcBalance) + parseFloat(amountUsdc)).toFixed(6);
  await setRobotState(redis, state);
});

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
      busy: isBusy,
    });
  });

  // Return 503 immediately if busy — before the x402 payment handshake fires
  app.use('/task', (req, res, next) => {
    if (req.method === 'POST' && isBusy) {
      res.status(503).json({ error: 'Robot busy', robotId, state: state.behaviorState });
      return;
    }
    next();
  });

  // Paid task delegation endpoint — requires 0.01 USDC per call
  app.use(
    paymentMiddleware(
      {
        'POST /task': {
          accepts: {
            scheme: 'exact',
            network: 'eip155:84532',
            payTo: account.address,
            price: '$0.01',
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

    isBusy = true;
    const behaviorState = requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
    await updateState({ behaviorState });

    // Simulate execution (scaled: 1 real sec = 100ms sim)
    await new Promise((r) => setTimeout(r, (estimatedDurationSecs ?? 2) * 100));

    await updateState({ behaviorState: 'IDLE', currentTaskId: null });
    isBusy = false;
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
        // ── Task acquired ──────────────────────────────────────────────────────
        const taskStart = Date.now();
        let subtasksSucceeded = 0;
        let subtasksFailed = 0;
        let totalUsdcPaid = 0;
        const allTxHashes: string[] = [];
        const peersUsed: Array<{ agentId: string; tokenId: string; success: boolean; txHash?: string }> = [];

        log.info({ taskId: task.taskId, description: task.description }, 'Task acquired');
        agentLog.append('TASK_RECEIVED', { taskId: task.taskId, description: task.description, priority: task.priority });

        await updateState({ behaviorState: 'EXECUTING', currentTaskId: task.taskId });

        await publishEvent(redis, {
          robotId,
          type: 'TASK_STARTED',
          state: 'EXECUTING',
          taskId: task.taskId,
          payload: {
            description: task.description,
            priority: task.priority,
            sourceZone: task.sourceZone,
            destinationZone: task.destinationZone,
          },
          timestamp: Date.now(),
        });

        isBusy = true;

        // ── Decompose via Groq ─────────────────────────────────────────────────
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

        // ── Execute sub-tasks ──────────────────────────────────────────────────
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

            // Move toward destination zone on NAVIGATE subtasks
            const targetZone = subtask.requiredCapability === 'NAVIGATE'
              ? (task.destinationZone ?? task.sourceZone)
              : undefined;
            const targetPos = targetZone ? ZONE_POSITIONS[targetZone] : undefined;

            await updateState({
              behaviorState,
              currentTaskId: task.taskId,
              ...(targetPos ? { position: targetPos } : {}),
            });

            await new Promise((r) => setTimeout(r, subtask.estimatedDurationSecs * 100));
            subtasksSucceeded++;
          } else {
            // ── Peer delegation chain ──────────────────────────────────────────
            await publishEvent(redis, {
              robotId,
              type: 'STATE_CHANGED',
              state: 'WAITING',
              taskId: task.taskId,
              payload: {
                step: `Querying registry for ${subtask.requiredCapability} peers`,
                subTaskId: subtask.subTaskId,
              },
              timestamp: Date.now(),
            });

            const candidates = await selectPeers(
              redis, log, agentLog, robotId,
              subtask.requiredCapability as import('./decomposer.js').Capability,
              manifest.compute.trustThreshold as number
            );

            if (candidates.length === 0) {
              log.warn({ subTaskId: subtask.subTaskId, requiredCapability: subtask.requiredCapability }, 'No qualified peers');
              agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: 'no qualified peers' });
              subtasksFailed++;
            } else {
              let subtaskDone = false;

              for (const peer of candidates) {
                if (subtaskDone) break;

                agentLog.append('PEER_SELECTED', {
                  agentId: peer.agentId,
                  tokenId: peer.tokenId.toString(),
                  reputationScore: peer.reputationScore,
                  isIdle: peer.isIdle,
                  endpoint: peer.endpoint,
                });

                await publishEvent(redis, {
                  robotId,
                  type: 'STATE_CHANGED',
                  state: 'WAITING',
                  taskId: task.taskId,
                  payload: {
                    step: `Selected ${peer.agentId} (rep: ${peer.reputationScore}) for ${subtask.requiredCapability}`,
                    peer: peer.agentId,
                    subTaskId: subtask.subTaskId,
                  },
                  timestamp: Date.now(),
                });

                try {
                  await updateState({ behaviorState: 'WAITING', currentTaskId: task.taskId });

                  agentLog.append('PAYMENT_INITIATED', {
                    peer: peer.agentId,
                    peerAddress: peer.endpoint,
                    amount: '0.01',
                    asset: 'USDC',
                    assetAddress: USDC_ADDRESS,
                    network: 'base-sepolia',
                    subTaskId: subtask.subTaskId,
                  });
                  log.info({ peer: peer.agentId, amount: '0.01 USDC', subTaskId: subtask.subTaskId }, 'Initiating x402 payment');

                  await publishEvent(redis, {
                    robotId,
                    type: 'PAYMENT_SENT',
                    state: 'WAITING',
                    taskId: task.taskId,
                    payload: { peer: peer.agentId, amount: '0.01 USDC', subTaskId: subtask.subTaskId },
                    timestamp: Date.now(),
                  });

                  const x402Fetch = makeX402Fetch(account);

                  // 30-second hard timeout on the full delegation round-trip
                  const controller = new AbortController();
                  const timer = setTimeout(() => controller.abort(), 30_000);

                  try {
                    const res = await x402Fetch(`${peer.endpoint}/task`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        subTaskId: subtask.subTaskId,
                        description: subtask.description,
                        requiredCapability: subtask.requiredCapability,
                        estimatedDurationSecs: subtask.estimatedDurationSecs,
                      }),
                      signal: controller.signal,
                    });
                    clearTimeout(timer);

                    if (res.status === 503) {
                      // Peer is busy — no payment made, try next candidate
                      log.info({ peer: peer.agentId, subTaskId: subtask.subTaskId }, 'Peer busy (503), trying next');
                      agentLog.append('PEER_DELEGATION', {
                        subTaskId: subtask.subTaskId,
                        peer: peer.agentId,
                        outcome: 'BUSY',
                      });
                      continue;
                    }

                    if (res.ok) {
                      const paymentResponse = res.headers.get('PAYMENT-RESPONSE');
                      agentLog.append('SUBTASK_EXECUTING', {
                        subTaskId: subtask.subTaskId,
                        delegatedTo: peer.agentId,
                        paymentTx: paymentResponse ?? undefined,
                      });
                      log.info({ subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Delegation succeeded');

                      // Debit USDC balance for this delegation
                      state.usdcBalance = Math.max(0, parseFloat(state.usdcBalance) - 0.01).toFixed(6);
                      await setRobotState(redis, state);
                      totalUsdcPaid += 0.01;

                      // Mark success BEFORE feedback — payment already settled, delegation is done
                      subtaskDone = true;
                      subtasksSucceeded++;

                      // Positive on-chain feedback — isolated so a revert doesn't abort the delegation
                      let feedbackTxHash: `0x${string}` | undefined;
                      try {
                        feedbackTxHash = await giveFeedback(account, peer.tokenId, 80, peer.endpoint);
                        allTxHashes.push(feedbackTxHash);
                      } catch (fbErr) {
                        log.warn({ fbErr, peer: peer.agentId }, 'Positive feedback write failed (delegation still succeeded)');
                      }

                      await publishEvent(redis, {
                        robotId,
                        type: 'REPUTATION_UPDATED',
                        state: 'WAITING',
                        taskId: task.taskId,
                        payload: {
                          peer: peer.agentId,
                          feedbackValue: 80,
                          txHash: feedbackTxHash,
                          subTaskId: subtask.subTaskId,
                        },
                        timestamp: Date.now(),
                      });

                      peersUsed.push({
                        agentId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        success: true,
                        ...(feedbackTxHash !== undefined ? { txHash: feedbackTxHash } : {}),
                      });
                    } else {
                      // Peer accepted payment but execution failed — negative feedback
                      log.warn({ subTaskId: subtask.subTaskId, status: res.status, peer: peer.agentId }, 'Peer execution failed');
                      agentLog.append('PEER_DELEGATION', {
                        subTaskId: subtask.subTaskId,
                        peer: peer.agentId,
                        outcome: 'FAILED',
                        httpStatus: res.status,
                      });

                      state.usdcBalance = Math.max(0, parseFloat(state.usdcBalance) - 0.01).toFixed(6);
                      await setRobotState(redis, state);
                      totalUsdcPaid += 0.01;

                      const feedbackTxHash = await giveFeedback(account, peer.tokenId, -50, peer.endpoint);
                      allTxHashes.push(feedbackTxHash);

                      await publishEvent(redis, {
                        robotId,
                        type: 'REPUTATION_UPDATED',
                        state: 'WAITING',
                        taskId: task.taskId,
                        payload: {
                          peer: peer.agentId,
                          feedbackValue: -50,
                          txHash: feedbackTxHash,
                          subTaskId: subtask.subTaskId,
                        },
                        timestamp: Date.now(),
                      });

                      peersUsed.push({
                        agentId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        success: false,
                        txHash: feedbackTxHash,
                      });
                      // Try next candidate
                    }
                  } catch (fetchErr) {
                    clearTimeout(timer);
                    const isTimeout = (fetchErr as Error).name === 'AbortError';
                    log.error({ fetchErr, subTaskId: subtask.subTaskId, peer: peer.agentId, isTimeout }, 'Delegation request failed');
                    agentLog.append('PEER_DELEGATION', {
                      subTaskId: subtask.subTaskId,
                      peer: peer.agentId,
                      outcome: isTimeout ? 'TIMEOUT' : 'PAYMENT_ERROR',
                      reason: (fetchErr as Error).message,
                    });

                    if (isTimeout) {
                      // Timeout: peer failed to respond — give negative feedback
                      try {
                        const feedbackTxHash = await giveFeedback(account, peer.tokenId, -50, peer.endpoint);
                        allTxHashes.push(feedbackTxHash);
                        peersUsed.push({
                          agentId: peer.agentId,
                          tokenId: peer.tokenId.toString(),
                          success: false,
                          txHash: feedbackTxHash,
                        });
                      } catch {
                        log.warn({ peer: peer.agentId }, 'Could not write negative feedback after timeout');
                      }
                    }
                    // Payment error: no feedback (payment did not go through)
                    // Continue to next candidate in either case
                  }
                } catch (outerErr) {
                  log.error({ outerErr, subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Unexpected delegation error');
                  agentLog.append('SUBTASK_ABORTED', {
                    subTaskId: subtask.subTaskId,
                    reason: (outerErr as Error).message,
                  });
                }
              }

              if (!subtaskDone) {
                agentLog.append('SUBTASK_ABORTED', {
                  subTaskId: subtask.subTaskId,
                  reason: 'all peer candidates failed or unavailable',
                });
                subtasksFailed++;
              }
            }
          }
        }

        isBusy = false;

        // ── Task summary ───────────────────────────────────────────────────────
        const executionTimeMs = Date.now() - taskStart;
        const taskStatus =
          subtasksFailed === 0 ? 'SUCCESS' :
          subtasksSucceeded === 0 ? 'FAILED' : 'PARTIALLY_FAILED';

        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
        await redis.hincrby('session:stats', 'tasksCompleted', 1);

        log.info({ taskId: task.taskId, taskStatus, executionTimeMs, subtasksSucceeded, subtasksFailed }, 'Task complete');
        agentLog.append('TASK_COMPLETE', {
          taskId: task.taskId,
          status: taskStatus,
          executionTimeMs,
          subTaskCount: subtasks.length,
          subtasksSucceeded,
          subtasksFailed,
          peersUsed,
          totalUsdcPaid: totalUsdcPaid.toFixed(6),
          onChainTxHashes: allTxHashes,
          groqCallsUsed: decomposer.getCallCount(),
        });

        await publishEvent(redis, {
          robotId,
          type: 'TASK_COMPLETED',
          state: 'IDLE',
          taskId: task.taskId,
          payload: {
            status: taskStatus,
            executionTimeMs,
            peersUsed: peersUsed.map((p) => p.agentId),
            totalUsdcPaid: totalUsdcPaid.toFixed(6),
            txHashes: allTxHashes,
          },
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      isBusy = false;
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

  // Read on-chain USDC balance at startup
  try {
    const balance = await getUsdcBalance(account.address);
    state.usdcBalance = balance;
    log.info({ usdcBalance: balance }, 'USDC balance loaded');
  } catch {
    log.warn('Could not read USDC balance at startup');
  }

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