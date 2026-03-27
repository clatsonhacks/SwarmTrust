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
import { releaseZoneLock } from '../shared/redis/zoneLock.js';
import { getZoneContents, setZoneContents, clearZoneContents } from '../shared/redis/zoneState.js';
import { AgentLogger } from './agentLog.js';
import { TaskDecomposer } from './decomposer.js';
import type { SubTask } from './decomposer.js';
import { selectPeers } from './peerSelector.js';
import { runSafetyChecks } from './safetyChecks.js';
import { giveFeedback, getUsdcBalance, USDC_ADDRESS } from '../shared/blockchain/contracts.js';
import { makeX402Fetch } from '../shared/x402/client.js';
import type { RobotId, RobotState, Task, ZoneId } from '../shared/types/index.js';

// ── Load manifest ──────────────────────────────────────────────────────────────
const robotId = (process.env.ROBOT_ID ?? 'scout-1') as RobotId;
const manifestPath = path.resolve(`agents/manifests/${robotId}.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// ── Init account early — needed for agentLog metadata ─────────────────────────
const rawKey = process.env[manifest.privateKeyEnv as string] ?? '';
const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);

// ── Load on-chain token ID for this robot ─────────────────────────────────────
const tokensPath = path.resolve('agents/tokens.json');
const tokens: Record<string, string> = fs.existsSync(tokensPath)
  ? JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
  : {};
const erc8004TokenId = tokens[robotId] ?? 'unknown';

// ── Logger + agent log ─────────────────────────────────────────────────────────
const log = pino({ level: 'info' }).child({ robotId });
const agentLog = new AgentLogger(robotId, erc8004TokenId, account.address);
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

function positionToZone(pos: { x: number; y: number }): string | undefined {
  for (const [zone, zPos] of Object.entries(ZONE_POSITIONS)) {
    if (pos.x === zPos.x && pos.y === zPos.y) return zone;
  }
  return undefined;
}

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

// ── Compute budget counters ────────────────────────────────────────────────────
let redisOpsTotal = 0;
let x402SentTotal = 0;
let x402ReceivedTotal = 0;

function trackRedisOp(n = 1): void {
  redisOpsTotal += n;
}

async function updateState(patch: Partial<RobotState>): Promise<void> {
  state = { ...state, ...patch, lastUpdated: Date.now() };
  trackRedisOp();
  await setRobotState(redis, state);
  trackRedisOp();
  await publishEvent(redis, {
    robotId,
    type: 'STATE_CHANGED',
    state: state.behaviorState,
    ...(state.currentTaskId ? { taskId: state.currentTaskId } : {}),
    timestamp: Date.now(),
  });
}

// ── Persist compute budget to Redis so orchestrator can broadcast it ───────────
async function flushBudget(): Promise<void> {
  const groqCalls = decomposer.getCallCount();
  agentLog.updateBudget({
    groqCalls,
    x402PaymentsSent: x402SentTotal,
    x402PaymentsReceived: x402ReceivedTotal,
    redisOps: redisOpsTotal,
  });
  trackRedisOp();
  await redis.hset(`robot:${robotId}:budget`, {
    groqCalls,
    x402PaymentsSent: x402SentTotal,
    x402PaymentsReceived: x402ReceivedTotal,
    redisOps: redisOpsTotal,
  });
}

// ── x402 resource server ───────────────────────────────────────────────────────
const resourceServer = registerExactEvmScheme(new x402ResourceServer());

resourceServer.onAfterSettle(async (ctx) => {
  x402ReceivedTotal++;
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
  trackRedisOp();
  await setRobotState(redis, state);
});

// ── Express server with x402-protected /task endpoint ─────────────────────────
function startHttpServer(): void {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      agentId: robotId,
      name: manifest.name,
      capabilities: manifest.capabilities,
      state: state.behaviorState,
      currentTaskId: state.currentTaskId,
      walletAddress: account.address,
      erc8004TokenId,
      busy: isBusy,
      computeBudget: agentLog.getBudget(),
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
    const { subTaskId, description, requiredCapability, estimatedDurationSecs, zone } = req.body as {
      subTaskId: string;
      description: string;
      requiredCapability: string;
      estimatedDurationSecs: number;
      zone?: string;
    };

    const subtaskStart = Date.now();
    log.info({ subTaskId, requiredCapability }, 'Delegated subtask received');
    agentLog.append('SUBTASK_EXECUTING', {
      subTaskId,
      description,
      requiredCapability,
      zone: zone ?? 'unspecified',
      delegated: true,
    });

    isBusy = true;
    const behaviorState = requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
    await updateState({ behaviorState });

    // Simulate execution (scaled: 1 real sec = 100ms sim)
    await new Promise((r) => setTimeout(r, (estimatedDurationSecs ?? 2) * 100));

    await updateState({ behaviorState: 'IDLE', currentTaskId: null });
    isBusy = false;

    const durationMs = Date.now() - subtaskStart;
    log.info({ subTaskId, durationMs }, 'Delegated subtask complete');
    agentLog.append('SUBTASK_COMPLETE', {
      subTaskId,
      durationMs,
      success: true,
      delegated: true,
    });

    res.json({ success: true, subTaskId, completedAt: Date.now() });
  });

  app.listen(manifest.payment.port, () => {
    log.info({ port: manifest.payment.port }, 'HTTP server listening');
  });
}

// ── Register in Redis ──────────────────────────────────────────────────────────
async function registerAgent(): Promise<void> {
  trackRedisOp();
  await redis.hset(`robot:${robotId}:config`, {
    endpoint: manifest.payment.endpoint,
    capabilities: manifest.capabilities.join(','),
    walletAddress: account.address,
    registeredAt: Date.now(),
  });
  log.info({ endpoint: manifest.payment.endpoint }, 'Registered in Redis');
}

// ── Retry queue item ───────────────────────────────────────────────────────────
interface RetryItem {
  subtask: SubTask;
  attemptCount: number;   // 1 on first retry, 2 on second, 3 on third
  retryAfter: number;     // Date.now() + 5000
  reason: string;
}

// ── Execute a self-handled subtask, including safety checks for irreversible ones
async function executeSelfSubtask(
  subtask: SubTask,
  task: Task,
  subtasksSucceeded: { value: number },
  subtasksFailed: { value: number },
  retryQueue: RetryItem[],
  retryAttempt: number,
): Promise<void> {
  const subtaskStart = Date.now();
  const isIrreversible = subtask.irreversible;

  agentLog.append('SUBTASK_EXECUTING', {
    subTaskId: subtask.subTaskId,
    description: subtask.description,
    requiredCapability: subtask.requiredCapability,
    zone: task.destinationZone,
    retry: retryAttempt > 0 ? retryAttempt : undefined,
  });

  // ── Safety checks for irreversible sub-tasks ─────────────────────────────────
  let lockAcquired = false;
  if (isIrreversible) {
    const robotCurrentZone = positionToZone(state.position);
    const safetyResult = await runSafetyChecks(
      redis, agentLog, subtask, task.taskId, robotId,
      task.destinationZone, robotCurrentZone
    );
    trackRedisOp(3); // task lock + occupancy read + zone lock

    if (!safetyResult.ok) {
      if (safetyResult.retryable && retryAttempt < 3) {
        retryQueue.push({
          subtask,
          attemptCount: retryAttempt + 1,
          retryAfter: Date.now() + 5_000,
          reason: safetyResult.reason,
        });
        agentLog.append('SUBTASK_ABORTED', {
          subTaskId: subtask.subTaskId,
          reason: safetyResult.reason,
          retryScheduled: true,
          attempt: retryAttempt + 1,
        });
        // count as failed for now; decremented if retry succeeds
        subtasksFailed.value++;
      } else {
        agentLog.append('SUBTASK_ABORTED', {
          subTaskId: subtask.subTaskId,
          reason: safetyResult.retryable ? 'max retries exceeded' : safetyResult.reason,
          retryScheduled: false,
        });
        subtasksFailed.value++;
      }
      return;
    }
    lockAcquired = safetyResult.lockAcquired;
  }

  // ── Execute ──────────────────────────────────────────────────────────────────
  const behaviorState = subtask.requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';

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

  // ── Zone contents management ─────────────────────────────────────────────────
  if (isIrreversible && task.destinationZone) {
    // Place action: mark destination as occupied, source as cleared
    trackRedisOp(2);
    await setZoneContents(redis, task.destinationZone, {
      palletId: `${task.taskId}-pallet`,
      itemCount: 1,
      lastUpdated: Date.now(),
    });
    await clearZoneContents(redis, task.sourceZone);
  } else if (subtask.requiredCapability === 'LIFT' && !isIrreversible) {
    // Pick-up action: clear the source zone
    trackRedisOp();
    await clearZoneContents(redis, task.sourceZone);
  }

  // Release zone lock immediately after action
  if (lockAcquired && task.destinationZone) {
    trackRedisOp();
    await releaseZoneLock(redis, task.destinationZone as ZoneId);
  }

  const durationMs = Date.now() - subtaskStart;
  agentLog.append('SUBTASK_COMPLETE', {
    subTaskId: subtask.subTaskId,
    durationMs,
    success: true,
    irreversible: isIrreversible,
    retry: retryAttempt > 0 ? retryAttempt : undefined,
  });

  subtasksSucceeded.value++;
}

// ── Main decision loop ─────────────────────────────────────────────────────────
async function runLoop(): Promise<void> {
  log.info('Starting decision loop...');

  while (true) {
    const iterationStart = Date.now();

    try {
      trackRedisOp(); // BLPOP
      const task: Task | null = await popTask(redis, 1);

      if (!task) {
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
      } else {
        // ── Task acquired ──────────────────────────────────────────────────────
        const taskStart = Date.now();
        const successes = { value: 0 };
        const failures  = { value: 0 };
        let totalUsdcPaid = 0;
        const allTxHashes: string[] = [];
        const peersUsed: Array<{ agentId: string; tokenId: string; success: boolean; txHash?: string }> = [];
        const retryQueue: RetryItem[] = [];

        log.info({ taskId: task.taskId, description: task.description }, 'Task acquired');
        agentLog.append('TASK_RECEIVED', {
          taskId: task.taskId,
          taskType: 'WAREHOUSE_OP',
          description: task.description,
          priority: task.priority,
          sourceZone: task.sourceZone,
          destinationZone: task.destinationZone,
        });

        await updateState({ behaviorState: 'EXECUTING', currentTaskId: task.taskId });

        trackRedisOp();
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
          subTasks: subtasks,
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
            await executeSelfSubtask(subtask, task, successes, failures, retryQueue, 0);
          } else {
            // ── Peer delegation chain ──────────────────────────────────────────
            trackRedisOp();
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
              agentLog.append('SUBTASK_ABORTED', {
                subTaskId: subtask.subTaskId,
                reason: 'no qualified peers',
                retryScheduled: false,
              });
              failures.value++;
            } else {
              // ── Safety checks before irreversible delegated subtasks ──────────
              let delegationLockAcquired = false;
              if (subtask.irreversible) {
                const safetyResult = await runSafetyChecks(
                  redis, agentLog, subtask, task.taskId, robotId,
                  task.destinationZone, positionToZone(state.position), true
                );
                trackRedisOp(3);
                if (!safetyResult.ok) {
                  if (safetyResult.retryable && retryQueue.filter(i => i.subtask.subTaskId === subtask.subTaskId).length < 3) {
                    retryQueue.push({ subtask, attemptCount: 1, retryAfter: Date.now() + 5_000, reason: safetyResult.reason });
                    agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: safetyResult.reason, retryScheduled: true, attempt: 1 });
                  } else {
                    agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: safetyResult.reason, retryScheduled: false });
                  }
                  failures.value++;
                  continue;
                }
                delegationLockAcquired = safetyResult.lockAcquired;
              }

              let subtaskDone = false;
              const subtaskStart = Date.now();

              for (const peer of candidates) {
                if (subtaskDone) break;

                agentLog.append('PEER_SELECTED', {
                  agentId: peer.agentId,
                  tokenId: peer.tokenId.toString(),
                  reputationScore: peer.reputationScore,
                  isIdle: peer.isIdle,
                  endpoint: peer.endpoint,
                  reason: peer.isIdle
                    ? 'highest reputation among idle peers'
                    : 'highest reputation (no idle peers available)',
                });

                trackRedisOp();
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
                    subTaskId: subtask.subTaskId,
                    recipient: peer.endpoint,
                    recipientAddress: account.address,
                    peer: peer.agentId,
                    amount: '0.01',
                    asset: 'USDC',
                    assetAddress: USDC_ADDRESS,
                    network: 'base-sepolia',
                  });
                  log.info({ peer: peer.agentId, amount: '0.01 USDC', subTaskId: subtask.subTaskId }, 'Initiating x402 payment');

                  trackRedisOp();
                  await publishEvent(redis, {
                    robotId,
                    type: 'PAYMENT_SENT',
                    state: 'WAITING',
                    taskId: task.taskId,
                    payload: { peer: peer.agentId, amount: '0.01 USDC', subTaskId: subtask.subTaskId },
                    timestamp: Date.now(),
                  });

                  const x402Fetch = makeX402Fetch(account);

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
                        zone: task.destinationZone,
                      }),
                      signal: controller.signal,
                    });
                    clearTimeout(timer);

                    if (res.status === 503) {
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
                      x402SentTotal++;

                      state.usdcBalance = Math.max(0, parseFloat(state.usdcBalance) - 0.01).toFixed(6);
                      trackRedisOp();
                      await setRobotState(redis, state);
                      totalUsdcPaid += 0.01;

                      subtaskDone = true;
                      successes.value++;

                      // Update zone contents and release lock if we held one
                      if (delegationLockAcquired && task.destinationZone) {
                        trackRedisOp(2);
                        await setZoneContents(redis, task.destinationZone, {
                          palletId: `${task.taskId}-pallet`,
                          itemCount: 1,
                          lastUpdated: Date.now(),
                        });
                        await clearZoneContents(redis, task.sourceZone);
                        await releaseZoneLock(redis, task.destinationZone as ZoneId);
                      }

                      agentLog.append('SUBTASK_COMPLETE', {
                        subTaskId: subtask.subTaskId,
                        durationMs: Date.now() - subtaskStart,
                        success: true,
                        delegatedTo: peer.agentId,
                        paymentTx: paymentResponse ?? undefined,
                      });

                      // Positive on-chain feedback — isolated; revert doesn't undo delegation
                      let feedbackTxHash: `0x${string}` | undefined;
                      try {
                        feedbackTxHash = await giveFeedback(account, peer.tokenId, 80, peer.endpoint);
                        allTxHashes.push(feedbackTxHash);
                      } catch (fbErr) {
                        log.warn({ fbErr, peer: peer.agentId }, 'Positive feedback write failed (delegation still succeeded)');
                      }

                      agentLog.append('REPUTATION_UPDATED', {
                        peerId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        delta: 80,
                        txHash: feedbackTxHash,
                        subTaskId: subtask.subTaskId,
                      });

                      trackRedisOp();
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

                      log.info({ subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Delegation succeeded');
                    } else {
                      // Payment accepted but execution failed — negative feedback
                      log.warn({ subTaskId: subtask.subTaskId, status: res.status, peer: peer.agentId }, 'Peer execution failed');
                      x402SentTotal++;
                      agentLog.append('PEER_DELEGATION', {
                        subTaskId: subtask.subTaskId,
                        peer: peer.agentId,
                        outcome: 'FAILED',
                        httpStatus: res.status,
                      });

                      state.usdcBalance = Math.max(0, parseFloat(state.usdcBalance) - 0.01).toFixed(6);
                      trackRedisOp();
                      await setRobotState(redis, state);
                      totalUsdcPaid += 0.01;

                      let fbHash: `0x${string}` | undefined;
                      try {
                        fbHash = await giveFeedback(account, peer.tokenId, -50, peer.endpoint);
                        allTxHashes.push(fbHash);
                      } catch { /* best-effort */ }

                      agentLog.append('REPUTATION_UPDATED', {
                        peerId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        delta: -50,
                        txHash: fbHash,
                        subTaskId: subtask.subTaskId,
                      });

                      peersUsed.push({
                        agentId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        success: false,
                        ...(fbHash !== undefined ? { txHash: fbHash } : {}),
                      });
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
                      let fbHash: `0x${string}` | undefined;
                      try {
                        fbHash = await giveFeedback(account, peer.tokenId, -50, peer.endpoint);
                        allTxHashes.push(fbHash);
                      } catch { /* best-effort */ }

                      agentLog.append('REPUTATION_UPDATED', {
                        peerId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        delta: -50,
                        txHash: fbHash,
                        subTaskId: subtask.subTaskId,
                      });

                      peersUsed.push({
                        agentId: peer.agentId,
                        tokenId: peer.tokenId.toString(),
                        success: false,
                        ...(fbHash !== undefined ? { txHash: fbHash } : {}),
                      });
                    }
                  }
                } catch (outerErr) {
                  log.error({ outerErr, subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Unexpected delegation error');
                  agentLog.append('SUBTASK_ABORTED', {
                    subTaskId: subtask.subTaskId,
                    reason: (outerErr as Error).message,
                    retryScheduled: false,
                  });
                }
              }

              if (!subtaskDone) {
                // Release zone lock if we held one and no candidate succeeded
                if (delegationLockAcquired && task.destinationZone) {
                  trackRedisOp();
                  await releaseZoneLock(redis, task.destinationZone as ZoneId);
                }
                agentLog.append('SUBTASK_ABORTED', {
                  subTaskId: subtask.subTaskId,
                  reason: 'all peer candidates exhausted',
                  retryScheduled: false,
                });
                failures.value++;
              }
            }
          }
        }

        // ── Retry loop — process safety-check failures with up to 3 attempts ────
        while (retryQueue.length > 0) {
          const earliest = Math.min(...retryQueue.map((i) => i.retryAfter));
          const waitMs = Math.max(0, earliest - Date.now());
          if (waitMs > 0) {
            log.info({ retryCount: retryQueue.length, waitMs }, 'Waiting before retry');
            await new Promise((r) => setTimeout(r, waitMs));
          }

          const now = Date.now();
          const ready = retryQueue.filter((i) => i.retryAfter <= now);
          for (const item of ready) {
            retryQueue.splice(retryQueue.indexOf(item), 1);
            log.info({ subTaskId: item.subtask.subTaskId, attempt: item.attemptCount }, 'Retrying subtask');

            // Count this retry: decrement failures temporarily so executeSelfSubtask
            // can re-add it if it fails again
            failures.value--;
            await executeSelfSubtask(item.subtask, task, successes, failures, retryQueue, item.attemptCount);
          }
        }

        isBusy = false;

        // ── Task summary ───────────────────────────────────────────────────────
        const executionTimeMs = Date.now() - taskStart;
        const taskStatus =
          failures.value === 0 ? 'SUCCESS' :
          successes.value === 0 ? 'FAILED' : 'PARTIALLY_FAILED';

        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
        trackRedisOp();
        await redis.hincrby('session:stats', 'tasksCompleted', 1);

        await flushBudget();

        log.info({ taskId: task.taskId, taskStatus, executionTimeMs, subtasksSucceeded: successes.value, subtasksFailed: failures.value }, 'Task complete');
        agentLog.append('TASK_COMPLETE', {
          taskId: task.taskId,
          status: taskStatus,
          executionTimeMs,
          subTaskCount: subtasks.length,
          subtasksSucceeded: successes.value,
          subtasksFailed: failures.value,
          peersUsed,
          totalUsdcPaid: totalUsdcPaid.toFixed(6),
          onChainTxHashes: allTxHashes,
          computeBudget: agentLog.getBudget(),
        });

        trackRedisOp();
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

  trackRedisOp();
  await publishEvent(redis, {
    robotId,
    type: 'STATE_CHANGED',
    state: 'IDLE',
    payload: {
      event: 'ROBOT_ONLINE',
      name: manifest.name,
      capabilities: manifest.capabilities,
      walletAddress: account.address,
      erc8004TokenId,
    },
    timestamp: Date.now(),
  });

  agentLog.append('ROBOT_ONLINE', {
    name: manifest.name,
    capabilities: manifest.capabilities,
    walletAddress: account.address,
    erc8004TokenId,
  });

  log.info('Robot online');

  await runLoop();
}

main().catch((err) => {
  log.error({ err }, 'Robot crashed');
  process.exit(1);
});