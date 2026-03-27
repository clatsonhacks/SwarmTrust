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
import { setZoneContents } from '../shared/redis/zoneState.js';
import { AgentLogger } from './agentLog.js';
import { TaskDecomposer } from './decomposer.js';
import { selectPeers } from './peerSelector.js';
import { runSafetyChecks } from './safetyChecks.js';
import { uploadLogToPinata } from './pinatUploader.js';
import { giveFeedback, getUsdcBalance, USDC_ADDRESS } from '../shared/blockchain/contracts.js';
import { makeX402Fetch } from '../shared/x402/client.js';
import type { RobotId, RobotState, Task } from '../shared/types/index.js';
import type { SubTask } from './decomposer.js';
import type { ZoneId } from '../shared/types/zone.js';
import type { PeerCandidate } from './peerSelector.js';

// ── Load manifest ──────────────────────────────────────────────────────────────
const robotId = (process.env.ROBOT_ID ?? 'scout-1') as RobotId;
const manifestPath = path.resolve(`agents/manifests/${robotId}.json`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Load ERC-8004 token ID for this robot
const tokensPath = path.resolve('agents/tokens.json');
const tokens: Record<string, string> = fs.existsSync(tokensPath)
  ? JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
  : {};
const erc8004TokenId = tokens[robotId] ?? 'unknown';

const log = pino({ level: 'info' }).child({ robotId });

// ── Init wallet ────────────────────────────────────────────────────────────────
const rawKey = process.env[manifest.privateKeyEnv as string] ?? '';
const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
const account = privateKeyToAccount(privateKey);

const agentLog = new AgentLogger(robotId, erc8004TokenId, account.address);
const decomposer = new TaskDecomposer(
  process.env.GROQ_API_KEY ?? '',
  manifest.compute.maxGroqCallsPerHour as number
);

// ── Redis ──────────────────────────────────────────────────────────────────────
const redis = createRedisClient();

// ── Module-level busy flag — prevents double-booking via HTTP ──────────────────
let isBusy = false;

// ── Compute budget tracker ─────────────────────────────────────────────────────
const computeBudget = { groqCalls: 0, x402PaymentsSent: 0, x402PaymentsReceived: 0, redisOps: 0 };

// ── Simulated zone positions for position check ────────────────────────────────
const ZONE_POSITIONS: Record<string, { x: number; y: number; z: number }> = {
  INTAKE:     { x: 0,  y: 0, z: 0 },
  STORAGE:    { x: 10, y: 0, z: 0 },
  PROCESSING: { x: 20, y: 0, z: 0 },
  PACKAGING:  { x: 30, y: 0, z: 0 },
  DISPATCH:   { x: 40, y: 0, z: 0 },
};

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

// ── Determine current zone from position ───────────────────────────────────────
function currentZoneFromPosition(): string | null {
  const { x, y, z } = state.position;
  for (const [zone, pos] of Object.entries(ZONE_POSITIONS)) {
    if (pos.x === x && pos.y === y && pos.z === z) return zone;
  }
  return null;
}

// ── x402 resource server ───────────────────────────────────────────────────────
const resourceServer = registerExactEvmScheme(new x402ResourceServer());

resourceServer.onAfterSettle(async (ctx) => {
  const amountUsdc = (Number(ctx.requirements.amount) / 1e6).toFixed(6);
  computeBudget.x402PaymentsReceived++;
  agentLog.updateBudget({ x402PaymentsReceived: computeBudget.x402PaymentsReceived });
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

// ── Execute a subtask on this robot ───────────────────────────────────────────
async function executeSelfSubtask(
  subtask: SubTask,
  taskId: string,
  destinationZone: ZoneId | null,
  palletId: string | null,
): Promise<boolean> {
  // Safety checks for irreversible actions
  if (subtask.irreversible && destinationZone !== null) {
    const robotCurrentZone = currentZoneFromPosition();
    const safety = await runSafetyChecks(
      redis, agentLog, subtask, taskId, robotId,
      destinationZone, robotCurrentZone, false
    );

    if (!safety.ok) {
      agentLog.append('SUBTASK_ABORTED', {
        subTaskId: subtask.subTaskId,
        reason: safety.reason,
        checkType: safety.checkType,
        retryable: safety.retryable,
      });
      return false;
    }
  }

  agentLog.append('SUBTASK_EXECUTING', { subTaskId: subtask.subTaskId, description: subtask.description, delegated: false });
  const behaviorState = subtask.requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
  await updateState({ behaviorState, currentTaskId: taskId });

  // Simulate: update position if navigating to zone
  if (subtask.requiredCapability === 'NAVIGATE' && destinationZone) {
    const pos = ZONE_POSITIONS[destinationZone];
    if (pos) state.position = pos;
  }

  await new Promise((r) => setTimeout(r, subtask.estimatedDurationSecs * 100));

  // Update zone contents after irreversible LIFT/CARRY
  if (subtask.irreversible && destinationZone !== null && palletId !== null) {
    await setZoneContents(redis, destinationZone, {
      palletId,
      itemCount: 1,
      lastUpdated: Date.now(),
    });
    agentLog.append('SUBTASK_COMPLETE', {
      subTaskId: subtask.subTaskId,
      destinationZone,
      palletId,
    });
  } else {
    agentLog.append('SUBTASK_COMPLETE', { subTaskId: subtask.subTaskId });
  }

  // Release zone lock if we acquired one
  if (subtask.irreversible && destinationZone !== null) {
    await releaseZoneLock(redis, destinationZone);
  }

  return true;
}

// ── Delegate a subtask to a peer via x402 ─────────────────────────────────────
interface RetryItem {
  subtask: SubTask;
  attemptCount: number;
  retryAfter: number;
  reason: string;
  destinationZone: ZoneId | null;
  palletId: string | null;
}

async function delegateSubtask(
  subtask: SubTask,
  taskId: string,
  peer: PeerCandidate,
  destinationZone: ZoneId | null,
): Promise<'success' | 'fail' | 'busy'> {
  // Safety check for irreversible delegation
  if (subtask.irreversible && destinationZone !== null) {
    const robotCurrentZone = currentZoneFromPosition();
    const safety = await runSafetyChecks(
      redis, agentLog, subtask, taskId, robotId,
      destinationZone, robotCurrentZone, true
    );

    if (!safety.ok) {
      agentLog.append('SUBTASK_ABORTED', {
        subTaskId: subtask.subTaskId,
        peer: peer.agentId,
        reason: safety.reason,
        checkType: safety.checkType,
        retryable: safety.retryable,
      });
      return safety.retryable ? 'fail' : 'fail';
    }
  }

  agentLog.append('PAYMENT_INITIATED', {
    peer: peer.agentId,
    peerAddress: peer.endpoint,
    amount: '0.01',
    asset: 'USDC',
    assetAddress: USDC_ADDRESS,
    network: 'base-sepolia',
    subTaskId: subtask.subTaskId,
  });
  log.info({ peer: peer.agentId, amount: '0.01 USDC', subTaskId: subtask.subTaskId }, 'Initiating x402 payment for delegation');

  const x402Fetch = makeX402Fetch(account);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

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

    clearTimeout(timeout);

    if (res.status === 503) {
      log.warn({ peer: peer.agentId, subTaskId: subtask.subTaskId }, 'Peer busy (503)');
      agentLog.append('PEER_DELEGATION', {
        subTaskId: subtask.subTaskId,
        peer: peer.agentId,
        outcome: 'peer_busy',
      });
      return 'busy';
    }

    if (res.ok) {
      const paymentResponse = res.headers.get('PAYMENT-RESPONSE');
      computeBudget.x402PaymentsSent++;
      agentLog.updateBudget({ x402PaymentsSent: computeBudget.x402PaymentsSent });

      agentLog.append('PEER_DELEGATION', {
        subTaskId: subtask.subTaskId,
        peer: peer.agentId,
        outcome: 'success',
        paymentTx: paymentResponse ?? undefined,
      });
      agentLog.append('SUBTASK_COMPLETE', { subTaskId: subtask.subTaskId, delegatedTo: peer.agentId });
      log.info({ subTaskId: subtask.subTaskId, peer: peer.agentId }, 'Delegation succeeded');

      // Deduct USDC paid
      state.usdcBalance = Math.max(0, parseFloat(state.usdcBalance) - 0.01).toFixed(6);
      await setRobotState(redis, state);

      // Release zone lock we may have acquired for delegation
      if (subtask.irreversible && destinationZone !== null) {
        await releaseZoneLock(redis, destinationZone);
      }

      // Positive on-chain feedback
      const feedbackTxHash = await giveFeedback(account, peer.tokenId, 80, peer.endpoint);
      agentLog.append('REPUTATION_UPDATED', {
        peer: peer.agentId,
        tokenId: peer.tokenId.toString(),
        delta: 80,
        ...(feedbackTxHash !== undefined ? { txHash: feedbackTxHash } : {}),
      });

      return 'success';
    } else {
      log.warn({ subTaskId: subtask.subTaskId, status: res.status }, 'Peer returned error');
      agentLog.append('SUBTASK_ABORTED', { subTaskId: subtask.subTaskId, reason: `peer HTTP ${res.status}` });

      // Release zone lock on failure too
      if (subtask.irreversible && destinationZone !== null) {
        await releaseZoneLock(redis, destinationZone);
      }
      return 'fail';
    }
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = (err as Error).name === 'AbortError';
    log.error({ err, subTaskId: subtask.subTaskId, isTimeout }, 'Delegation failed');
    agentLog.append('SUBTASK_ABORTED', {
      subTaskId: subtask.subTaskId,
      reason: isTimeout ? 'delegation timeout (30s)' : (err as Error).message,
    });

    // Release zone lock on failure
    if (subtask.irreversible && destinationZone !== null) {
      await releaseZoneLock(redis, destinationZone);
    }

    // Negative feedback on timeout
    if (isTimeout) {
      try {
        const feedbackTxHash = await giveFeedback(account, peer.tokenId, -50, peer.endpoint);
        agentLog.append('REPUTATION_UPDATED', {
          peer: peer.agentId,
          tokenId: peer.tokenId.toString(),
          delta: -50,
          reason: 'timeout',
          ...(feedbackTxHash !== undefined ? { txHash: feedbackTxHash } : {}),
        });
      } catch { /* best-effort */ }
    }

    return 'fail';
  }
}

// ── HTTP server ────────────────────────────────────────────────────────────────
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
      isBusy,
    });
  });

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
    if (isBusy) {
      res.status(503).json({ error: 'robot busy' });
      return;
    }

    const { subTaskId, description, requiredCapability, estimatedDurationSecs } = req.body as {
      subTaskId: string;
      description: string;
      requiredCapability: string;
      estimatedDurationSecs: number;
    };

    isBusy = true;
    log.info({ subTaskId, requiredCapability }, 'Delegated subtask received');
    agentLog.append('SUBTASK_EXECUTING', { subTaskId, description, delegated: true });

    const behaviorState = requiredCapability === 'NAVIGATE' ? 'MOVING' : 'EXECUTING';
    await updateState({ behaviorState });

    await new Promise((r) => setTimeout(r, (estimatedDurationSecs ?? 2) * 100));

    isBusy = false;
    await updateState({ behaviorState: 'IDLE', currentTaskId: null });
    log.info({ subTaskId }, 'Delegated subtask complete');
    agentLog.append('SUBTASK_COMPLETE', { subTaskId, delegated: true });

    res.json({ success: true, subTaskId, completedAt: Date.now() });
  });

  // Railway injects PORT; fall back to manifest port for local dev
  const port = Number(process.env.PORT ?? manifest.payment.port);
  app.listen(port, () => {
    log.info({ port }, 'HTTP server listening');
  });
}

// ── Register in Redis ──────────────────────────────────────────────────────────
async function registerAgent(): Promise<void> {
  // ROBOT_ENDPOINT is set per-service in Railway (the public https:// URL)
  const endpoint = process.env.ROBOT_ENDPOINT ?? manifest.payment.endpoint;
  await redis.hset(`robot:${robotId}:config`, {
    endpoint,
    capabilities: manifest.capabilities.join(','),
    walletAddress: account.address,
    registeredAt: Date.now(),
  });
  log.info({ endpoint }, 'Registered in Redis');
}

// ── Main decision loop ─────────────────────────────────────────────────────────
async function runLoop(): Promise<void> {
  log.info('Starting decision loop...');

  while (true) {
    const iterationStart = Date.now();

    try {
      const task: Task | null = await popTask(redis, 1);

      if (!task) {
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
      } else {
        log.info({ taskId: task.taskId, description: task.description }, 'Task acquired');
        agentLog.append('TASK_RECEIVED', { taskId: task.taskId, description: task.description, priority: task.priority });

        await updateState({ behaviorState: 'EXECUTING', currentTaskId: task.taskId });

        // ── Decompose via Groq ──────────────────────────────────────────────
        const { subtasks, fromCache, fromFallback, groqCallsRemaining } = await decomposer.decompose(
          task.taskId,
          task.description,
          manifest.capabilities as string[]
        );
        computeBudget.groqCalls = decomposer.getCallCount();
        agentLog.updateBudget({ groqCalls: computeBudget.groqCalls });

        log.info({ taskId: task.taskId, subTaskCount: subtasks.length, fromCache, fromFallback }, 'Task decomposed');
        agentLog.append('TASK_DECOMPOSED', {
          taskId: task.taskId,
          subTaskCount: subtasks.length,
          fromCache,
          fromFallback,
          groqCallsRemaining,
          subtasks,
        });

        // Infer destination zone + palletId from task description (simple heuristic)
        const zoneMatch = task.description.match(/\b(INTAKE|STORAGE|PROCESSING|PACKAGING|DISPATCH)\b/);
        const destinationZone = (zoneMatch ? zoneMatch[1] : null) as ZoneId | null;
        const palletMatch = task.description.match(/pallet[- ]?(\S+)/i);
        const palletId = palletMatch ? palletMatch[0].replace(/\s/g, '-') : `${task.taskId}-pallet`;

        // ── Retry queue ─────────────────────────────────────────────────────
        const retryQueue: RetryItem[] = [];
        let subtasksSucceeded = 0;
        let subtasksFailed = 0;

        // ── Execute subtasks ────────────────────────────────────────────────
        for (const subtask of subtasks) {
          const canDo = (manifest.capabilities as string[]).includes(subtask.requiredCapability);

          agentLog.append('CAPABILITY_CHECK', {
            subTaskId: subtask.subTaskId,
            description: subtask.description,
            requiredCapability: subtask.requiredCapability,
            canDo,
            action: canDo ? 'SELF_EXECUTE' : 'NEEDS_PEER',
          });

          if (canDo) {
            const ok = await executeSelfSubtask(subtask, task.taskId, destinationZone, palletId);
            if (ok) {
              subtasksSucceeded++;
            } else {
              retryQueue.push({ subtask, attemptCount: 1, retryAfter: Date.now() + 5_000, reason: 'safety_check_failed', destinationZone, palletId });
            }
          } else {
            // ── Peer delegation ─────────────────────────────────────────────
            await updateState({ behaviorState: 'WAITING', currentTaskId: task.taskId });

            const peers = await selectPeers(
              redis, log, agentLog, robotId,
              subtask.requiredCapability as import('./decomposer.js').Capability,
              manifest.compute.trustThreshold as number
            );

            if (peers.length === 0) {
              subtasksFailed++;
              retryQueue.push({ subtask, attemptCount: 1, retryAfter: Date.now() + 5_000, reason: 'no_peers', destinationZone, palletId });
              continue;
            }

            let delegated = false;
            for (const peer of peers) {
              const outcome = await delegateSubtask(subtask, task.taskId, peer, destinationZone);
              if (outcome === 'success') {
                subtasksSucceeded++;
                delegated = true;
                break;
              } else if (outcome === 'busy') {
                // Try next peer in ranked list
                continue;
              } else {
                // Permanent fail for this peer — try next
                continue;
              }
            }

            if (!delegated) {
              subtasksFailed++;
              retryQueue.push({ subtask, attemptCount: 1, retryAfter: Date.now() + 5_000, reason: 'all_peers_failed', destinationZone, palletId });
            }
          }
        }

        // ── Drain retry queue ───────────────────────────────────────────────
        const MAX_ATTEMPTS = 3;
        while (retryQueue.length > 0) {
          const now = Date.now();
          const item = retryQueue[0]!;

          if (item.retryAfter > now) {
            await new Promise((r) => setTimeout(r, Math.min(item.retryAfter - now, 500)));
            continue;
          }

          retryQueue.shift();

          if (item.attemptCount >= MAX_ATTEMPTS) {
            log.warn({ subTaskId: item.subtask.subTaskId, attempts: item.attemptCount }, 'Subtask exceeded max retries');
            agentLog.append('SUBTASK_ABORTED', {
              subTaskId: item.subtask.subTaskId,
              reason: `exceeded max retries (${MAX_ATTEMPTS})`,
              originalReason: item.reason,
            });
            subtasksFailed++;
            continue;
          }

          log.info({ subTaskId: item.subtask.subTaskId, attempt: item.attemptCount + 1 }, 'Retrying subtask');

          const canDo = (manifest.capabilities as string[]).includes(item.subtask.requiredCapability);
          if (canDo) {
            const ok = await executeSelfSubtask(item.subtask, task.taskId, item.destinationZone, item.palletId);
            if (ok) {
              subtasksSucceeded++;
            } else {
              retryQueue.push({ ...item, attemptCount: item.attemptCount + 1, retryAfter: Date.now() + 5_000 });
            }
          } else {
            const peers = await selectPeers(
              redis, log, agentLog, robotId,
              item.subtask.requiredCapability as import('./decomposer.js').Capability,
              manifest.compute.trustThreshold as number
            );

            let delegated = false;
            for (const peer of peers) {
              const outcome = await delegateSubtask(item.subtask, task.taskId, peer, item.destinationZone);
              if (outcome === 'success') {
                subtasksSucceeded++;
                delegated = true;
                break;
              }
            }

            if (!delegated) {
              retryQueue.push({ ...item, attemptCount: item.attemptCount + 1, retryAfter: Date.now() + 5_000 });
            }
          }
        }

        // ── Task complete ───────────────────────────────────────────────────
        await updateState({ behaviorState: 'IDLE', currentTaskId: null });
        await redis.hincrby('session:stats', 'tasksCompleted', 1);

        const taskOutcome = subtasksFailed === 0 ? 'SUCCESS' : subtasksSucceeded > 0 ? 'PARTIAL' : 'FAILED';
        log.info({ taskId: task.taskId, outcome: taskOutcome }, 'Task complete');

        agentLog.append('TASK_COMPLETE', {
          taskId: task.taskId,
          outcome: taskOutcome,
          subTaskCount: subtasks.length,
          subtasksSucceeded,
          subtasksFailed,
          groqCallsUsed: decomposer.getCallCount(),
          computeBudget: agentLog.getBudget(),
        });

        await publishEvent(redis, {
          robotId,
          type: 'TASK_COMPLETED',
          state: 'IDLE',
          taskId: task.taskId,
          timestamp: Date.now(),
        });

        // ── Upload log to Pinata (IPFS) ──────────────────────────────────────
        const uploadResult = await uploadLogToPinata(agentLog.getFilePath(), log);
        if (uploadResult) {
          agentLog.append('LOG_UPLOADED', {
            cid: uploadResult.cid,
            gatewayUrl: uploadResult.gatewayUrl,
            durationMs: uploadResult.durationMs,
            service: 'pinata',
          });
          log.info({ cid: uploadResult.cid, url: uploadResult.gatewayUrl }, 'Log uploaded to IPFS');

          await publishEvent(redis, {
            robotId,
            type: 'TASK_COMPLETED',
            state: 'IDLE',
            taskId: task.taskId,
            payload: { logCid: uploadResult.cid, logUrl: uploadResult.gatewayUrl },
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
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

  // Start HTTP server immediately so /health passes Railway's health check
  // before any slow blockchain calls
  startHttpServer();
  await registerAgent();

  // USDC balance is best-effort — don't block startup on RPC latency
  getUsdcBalance(account.address)
    .then((balance) => {
      state.usdcBalance = balance;
      log.info({ usdcBalance: balance }, 'USDC balance loaded');
    })
    .catch(() => log.warn('Could not read USDC balance at startup'));
  await updateState({ behaviorState: 'IDLE' });

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
    erc8004TokenId,
  });

  log.info('Robot online');

  await runLoop();
}

main().catch((err) => {
  log.error({ err }, 'Robot crashed');
  process.exit(1);
});
