import fs from 'fs';
import path from 'path';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { AgentLogger } from './agentLog.js';
import { makePublicClient, getReputationScore } from '../shared/blockchain/contracts.js';
import type { Capability } from './decomposer.js';
import type { RobotId } from '../shared/types/index.js';

export interface PeerCandidate {
  agentId: RobotId;
  tokenId: bigint;
  endpoint: string;
  reputationScore: number;
  isIdle: boolean;
}

// ── 30-second in-memory reputation cache ─────────────────────────────────────
const repCache = new Map<string, { score: number | null; cachedAt: number }>();
const REP_CACHE_TTL_MS = 30_000;

async function getCachedReputation(
  publicClient: ReturnType<typeof makePublicClient>,
  tokenId: bigint
): Promise<number | null> {
  const key = tokenId.toString();
  const cached = repCache.get(key);
  if (cached && Date.now() - cached.cachedAt < REP_CACHE_TTL_MS) {
    return cached.score;
  }
  const score = await getReputationScore(publicClient, tokenId);
  repCache.set(key, { score, cachedAt: Date.now() });
  return score;
}

// ── Load token registry ───────────────────────────────────────────────────────
function loadTokens(): Record<string, string> {
  const p = path.resolve('agents/tokens.json');
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// ── Peer selection — returns full ranked list for retry logic ─────────────────
export async function selectPeers(
  redis: Redis,
  log: Logger,
  agentLog: AgentLogger,
  selfAgentId: RobotId,
  requiredCapability: Capability,
  trustThreshold: number
): Promise<PeerCandidate[]> {
  const publicClient = makePublicClient();
  const tokens = loadTokens();

  // Step 1: Discover peers with required capability from Redis
  const allKeys = await redis.keys('robot:*:config');
  const candidates: { agentId: RobotId; endpoint: string }[] = [];

  for (const key of allKeys) {
    const peerId = key.split(':')[1] as RobotId;
    if (peerId === selfAgentId) continue;

    const config = await redis.hgetall(key);
    const capabilities = (config.capabilities ?? '').split(',');

    if (capabilities.includes(requiredCapability)) {
      candidates.push({ agentId: peerId, endpoint: config.endpoint ?? '' });
    }
  }

  agentLog.append('PEER_QUERY', {
    requiredCapability,
    candidatesFound: candidates.length,
    candidates: candidates.map((c) => c.agentId),
  });

  log.info({ requiredCapability, candidatesFound: candidates.length }, 'Peer query');

  if (candidates.length === 0) {
    return [];
  }

  // Step 2: Get reputation scores + filter by threshold
  const qualified: Omit<PeerCandidate, 'isIdle'>[] = [];

  for (const { agentId, endpoint } of candidates) {
    const tokenIdStr = tokens[agentId];
    if (!tokenIdStr) {
      agentLog.append('REPUTATION_CHECK', { agentId, tokenId: null, score: null, passed: false, reason: 'no token registered' });
      continue;
    }

    const tokenId = BigInt(tokenIdStr);
    const score = await getCachedReputation(publicClient, tokenId);

    // New agents with no feedback (null) → assume trusted for bootstrap
    const effectiveScore = score ?? 85;
    const passed = effectiveScore >= trustThreshold;

    agentLog.append('REPUTATION_CHECK', { agentId, tokenId: tokenIdStr, score: effectiveScore, threshold: trustThreshold, passed });
    log.info({ agentId, score: effectiveScore, passed }, 'Reputation check');

    if (passed) {
      qualified.push({ agentId, tokenId, endpoint, reputationScore: effectiveScore });
    }
  }

  if (qualified.length === 0) {
    agentLog.append('SUBTASK_ABORTED', { reason: 'no peers above trust threshold', requiredCapability, threshold: trustThreshold });
    return [];
  }

  // Step 3: Sort by reputation, tie-break by IDLE state
  const ranked: PeerCandidate[] = await Promise.all(
    qualified.map(async (peer) => {
      const behaviorState = await redis.hget(`robot:${peer.agentId}:state`, 'behaviorState');
      return { ...peer, isIdle: behaviorState === 'IDLE' };
    })
  );

  ranked.sort((a, b) => {
    if (a.isIdle !== b.isIdle) return a.isIdle ? -1 : 1;
    return b.reputationScore - a.reputationScore;
  });

  log.info(
    { count: ranked.length, top: ranked[0]?.agentId, topScore: ranked[0]?.reputationScore },
    'Peer candidates ranked'
  );

  return ranked;
}