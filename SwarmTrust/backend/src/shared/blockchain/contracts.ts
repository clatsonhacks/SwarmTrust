import { createPublicClient, createWalletClient, http, toBytes, toHex, zeroHash, decodeEventLog } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { identityRegistryAbi } from '../abis/identityRegistry.js';
import { reputationRegistryAbi } from '../abis/reputationRegistry.js';

const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS as `0x${string}`;
const REPUTATION_REGISTRY = process.env.REPUTATION_REGISTRY_ADDRESS as `0x${string}`;
const FEEDBACK_TAG = 'peer_delegation';

export function makePublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
}

function makeWalletClient(account: PrivateKeyAccount) {
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
}

// ── Identity Registry ─────────────────────────────────────────────────────────

export async function registerOnChain(
  account: PrivateKeyAccount,
  agentURI: string
): Promise<bigint> {
  const publicClient = makePublicClient();
  const walletClient = makeWalletClient(account);

  const txHash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [agentURI],
    chain: baseSepolia,
    account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let agentId: bigint | undefined;
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: identityRegistryAbi,
        data: log.data,
        topics: log.topics,
        eventName: 'Registered',
      });
      agentId = event.args.agentId;
      break;
    } catch {
      // Not the Registered event
    }
  }

  if (agentId === undefined) throw new Error('Registered event not found in receipt');

  // Poll until the token is visible on the RPC node we'll use next
  // (avoids ERC721NonexistentToken when a load-balanced node hasn't caught up)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: identityRegistryAbi,
        functionName: 'ownerOf',
        args: [agentId],
      });
      break; // token is visible — safe to proceed
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return agentId;
}

export async function setCapabilitiesOnChain(
  account: PrivateKeyAccount,
  agentId: bigint,
  capabilities: string[]
): Promise<void> {
  const publicClient = makePublicClient();
  const walletClient = makeWalletClient(account);
  const encoded = toHex(toBytes(capabilities.join(',')));

  const txHash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: 'setMetadata',
    args: [agentId, 'capabilities', encoded],
    chain: baseSepolia,
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

// ── Reputation Registry ───────────────────────────────────────────────────────

export async function giveFeedback(
  account: PrivateKeyAccount,
  agentId: bigint,
  value: number,
  endpoint: string
): Promise<`0x${string}`> {
  const publicClient = makePublicClient();
  const walletClient = makeWalletClient(account);

  // Snapshot nonce before sending so we can wait for it to advance
  const nonceBefore = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'latest',
  });

  const txHash = await walletClient.writeContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [agentId, BigInt(value), 0, FEEDBACK_TAG, '', endpoint, '', zeroHash],
    chain: baseSepolia,
    account,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Poll until every load-balanced node reflects the confirmed nonce,
  // otherwise the next tx from the same account gets a stale nonce
  for (let i = 0; i < 15; i++) {
    const nonceNow = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'latest',
    });
    if (nonceNow > nonceBefore) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  return txHash;
}

/**
 * Compute a 0–100 reputation score.
 * Returns null if no feedback exists yet (new agent).
 */
export async function getReputationScore(
  publicClient: ReturnType<typeof makePublicClient>,
  agentId: bigint
): Promise<number | null> {
  const clients = await publicClient.readContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getClients',
    args: [agentId],
  });

  if (clients.length === 0) return null;

  const [count, summaryValue] = await publicClient.readContract({
    address: REPUTATION_REGISTRY,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [agentId, clients, FEEDBACK_TAG, ''],
  });

  if (count === 0n) return null;

  const avg = Number(summaryValue) / Number(count);
  return Math.round((avg + 100) / 2);
}