import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Redis } from 'ioredis';
import {
  registerOnChain,
  setCapabilitiesOnChain,
  sendEth,
  transferUsdc,
  getUsdcBalance,
} from '../shared/blockchain/contracts.js';

export interface SpawnResult {
  robotId: string;
  name: string;
  capabilities: string[];
  walletAddress: string;
  tokenId: string;
  port: number;
  endpoint: string;
  usdcBalance: string;
}

function robotTypeFromCapabilities(capabilities: string[]): string {
  if (capabilities.includes('SCAN')) return 'scout';
  if (capabilities.includes('LIFT')) return 'lifter';
  if (capabilities.includes('CARRY')) return 'carrier';
  return 'robot';
}

/**
 * Spawn a new robot agent:
 *  1. Generate wallet
 *  2. Fund with testnet USDC (requires FAUCET_PRIVATE_KEY env var)
 *  3. Register ERC-8004 identity on-chain
 *  4. Set capabilities on-chain
 *  5. Assign dynamic port via Redis INCR
 *  6. Write manifest + update tokens.json
 *  7. Fork robot process (tsx src/robot/index.ts)
 *  8. Wait for robot to register in Redis (up to 30s)
 */
export async function spawnRobot(
  redis: Redis,
  capabilities: string[],
  customName?: string,
): Promise<SpawnResult> {
  // ── Step 1: Generate wallet ──────────────────────────────────────────────────
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  // ── Step 2: Derive robot ID and name ─────────────────────────────────────────
  const typeLabel = robotTypeFromCapabilities(capabilities);
  const suffix = Math.random().toString(36).slice(2, 7);
  const robotId = `${typeLabel}-${suffix}`;
  const name =
    customName ??
    `SwarmTrust-${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}-${suffix}`;

  // ── Step 3: Fund wallet with ETH (gas) + testnet USDC ───────────────────────
  let usdcBalance = '0.000000';
  const faucetKeyRaw = process.env.FAUCET_PRIVATE_KEY;
  if (faucetKeyRaw) {
    const faucetKey = (
      faucetKeyRaw.startsWith('0x') ? faucetKeyRaw : `0x${faucetKeyRaw}`
    ) as `0x${string}`;
    const faucetAccount = privateKeyToAccount(faucetKey);
    // ETH first so the new wallet can pay gas for on-chain registration
    await sendEth(faucetAccount, account.address, 0.005);
    await transferUsdc(faucetAccount, account.address, 0.5);
    usdcBalance = await getUsdcBalance(account.address);
  } else {
    console.warn(`[spawner] FAUCET_PRIVATE_KEY not set — ${robotId} will start with 0 ETH/USDC and cannot register on-chain`);
  }

  // ── Step 4: Register ERC-8004 identity on-chain ──────────────────────────────
  // Use a descriptive placeholder URI; the manifest file is the source of truth locally.
  const agentURI = `https://swarmtrust.local/agents/${robotId}`;
  const tokenIdBigInt = await registerOnChain(account, agentURI);
  const tokenId = tokenIdBigInt.toString();

  // ── Step 5: Set capabilities on-chain ────────────────────────────────────────
  await setCapabilitiesOnChain(account, tokenIdBigInt, capabilities);

  // ── Step 6: Assign dynamic port ──────────────────────────────────────────────
  // SET NX initialises the counter only if it doesn't exist yet (first ever spawn).
  // Ports 3001–3005 are reserved for the 5 static robots; dynamic robots start at 3006.
  await redis.set('next_robot_port', '3005', 'NX');
  const port = Number(await redis.incr('next_robot_port'));

  // ── Step 7: Write manifest + update tokens.json ──────────────────────────────
  const privateKeyEnvVar = `DYNAMIC_ROBOT_${robotId.replace(/-/g, '_').toUpperCase()}_KEY`;

  const endpoint =
    process.env.ROBOT_ENDPOINT ??
    `http://localhost:${port}`;

  const manifest = {
    agentId: robotId,
    name,
    version: '1.0.0',
    type: typeLabel.toUpperCase(),
    capabilities,
    privateKeyEnv: privateKeyEnvVar,
    payment: { endpoint, port },
    compute: {
      maxConcurrentTasks: 1,
      trustThreshold: 80,
      maxGroqCallsPerHour: 50,
    },
    acceptedTokens: [
      {
        symbol: 'USDC',
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        network: 'base-sepolia',
        chainId: 84532,
      },
    ],
    networks: ['base-sepolia'],
  };

  const manifestDir = path.resolve('agents/manifests');
  fs.writeFileSync(
    path.join(manifestDir, `${robotId}.json`),
    JSON.stringify(manifest, null, 2),
  );

  const tokensPath = path.resolve('agents/tokens.json');
  const tokens: Record<string, string> = fs.existsSync(tokensPath)
    ? JSON.parse(fs.readFileSync(tokensPath, 'utf-8'))
    : {};
  tokens[robotId] = tokenId;
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));

  // ── Step 8: Fork robot process ───────────────────────────────────────────────
  const tsxBin = path.resolve('node_modules/.bin/tsx');
  const robotScript = path.resolve('src/robot/index.ts');

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ROBOT_ID: robotId,
    [privateKeyEnvVar]: privateKey,
    PORT: String(port),
    ROBOT_ENDPOINT: endpoint,
  };

  const child = spawn(tsxBin, [robotScript], {
    env: childEnv,
    stdio: 'inherit',
    detached: false,
  });

  child.on('error', (err) => {
    console.error(`[spawner] Robot process error for ${robotId}:`, err);
  });
  child.on('exit', (code, signal) => {
    console.warn(`[spawner] Robot ${robotId} exited (code=${code}, signal=${signal})`);
  });

  // ── Step 9: Wait for robot to register in Redis ───────────────────────────────
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const exists = await redis.exists(`robot:${robotId}:state`);
    if (exists) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  return { robotId, name, capabilities, walletAddress: account.address, tokenId, port, endpoint, usdcBalance };
}
