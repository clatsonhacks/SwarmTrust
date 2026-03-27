/**
 * One-time agent registration script.
 * Run: tsx scripts/register-agents.ts
 *
 * What it does:
 *  1. Upload each agent.json to IPFS via Pinata
 *  2. Register each agent on the ERC-8004 Identity Registry
 *  3. Store capabilities as on-chain metadata
 *  4. Seed cross-robot reputation (each robot vouches for all others)
 *  5. Save tokenIds to agents/tokens.json
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PinataSDK } from 'pinata';
import { privateKeyToAccount } from 'viem/accounts';
import type { PrivateKeyAccount } from 'viem/accounts';
import {
  registerOnChain,
  setCapabilitiesOnChain,
  giveFeedback,
} from '../src/shared/blockchain/contracts.js';

const ROBOT_CONFIG = [
  { agentId: 'scout-1',   privateKeyEnv: 'ROBOT_1_PRIVATE_KEY' },
  { agentId: 'lifter-2',  privateKeyEnv: 'ROBOT_2_PRIVATE_KEY' },
  { agentId: 'scout-3',   privateKeyEnv: 'ROBOT_3_PRIVATE_KEY' },
  { agentId: 'carrier-4', privateKeyEnv: 'ROBOT_4_PRIVATE_KEY' },
  { agentId: 'lifter-5',  privateKeyEnv: 'ROBOT_5_PRIVATE_KEY' },
];

const pinata = new PinataSDK({ pinataJwt: process.env.PINATA_JWT ?? '' });

function loadManifest(agentId: string) {
  const p = path.resolve(`agents/manifests/${agentId}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function makeAccount(privateKeyEnv: string): PrivateKeyAccount {
  const raw = process.env[privateKeyEnv] ?? '';
  const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
  return privateKeyToAccount(key);
}

async function main() {
  console.log('Starting agent registration...\n');

  const tokensPath = path.resolve('agents/tokens.json');
  let tokens: Record<string, string> = {};
  const accounts: PrivateKeyAccount[] = [];
  const tokenIds: bigint[] = [];

  // ── Phase 1: Upload to IPFS + register on-chain ──────────────────────────
  if (fs.existsSync(tokensPath)) {
    // Already registered — load existing token IDs and skip Phase 1
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    for (const { agentId, privateKeyEnv } of ROBOT_CONFIG) {
      accounts.push(makeAccount(privateKeyEnv));
      tokenIds.push(BigInt(tokens[agentId]!));
    }
    console.log('agents/tokens.json found — skipping Phase 1 (already registered)\n');
    console.log(JSON.stringify(tokens, null, 2), '\n');
  } else {
    for (const { agentId, privateKeyEnv } of ROBOT_CONFIG) {
      const manifest = loadManifest(agentId);
      const account = makeAccount(privateKeyEnv);
      accounts.push(account);

      console.log(`[${agentId}] Uploading to IPFS...`);
      const upload = await pinata.upload.public.json(manifest);
      const agentURI = `ipfs://${upload.cid}`;
      console.log(`[${agentId}] IPFS CID: ${upload.cid}`);

      console.log(`[${agentId}] Registering on Identity Registry...`);
      const tokenId = await registerOnChain(account, agentURI);
      tokenIds.push(tokenId);
      tokens[agentId] = tokenId.toString();
      console.log(`[${agentId}] Token ID: ${tokenId}`);

      console.log(`[${agentId}] Storing capabilities on-chain...`);
      await setCapabilitiesOnChain(account, tokenId, manifest.capabilities);
      console.log(`[${agentId}] Capabilities stored: ${manifest.capabilities.join(', ')}\n`);
    }

    // Save tokens before starting Phase 2 so a retry can skip Phase 1
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
    console.log('Saved token IDs to agents/tokens.json\n');
  }

  // ── Phase 2: Seed cross-robot reputation ─────────────────────────────────
  console.log('Seeding initial reputation scores...');

  for (let i = 0; i < ROBOT_CONFIG.length; i++) {
    for (let j = 0; j < ROBOT_CONFIG.length; j++) {
      if (i === j) continue;
      const targetManifest = loadManifest(ROBOT_CONFIG[j]!.agentId);
      const targetTokenId = tokenIds[j]!;

      process.stdout.write(`  ${ROBOT_CONFIG[i]!.agentId} → ${ROBOT_CONFIG[j]!.agentId} (token ${targetTokenId})... `);
      await giveFeedback(accounts[i]!, targetTokenId, 100, targetManifest.payment.endpoint);
      console.log('done');
    }
  }

  // ── Phase 3: Confirm tokens.json ──────────────────────────────────────────
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  console.log(`\nSaved token IDs to agents/tokens.json:`);
  console.log(JSON.stringify(tokens, null, 2));
  console.log('\nRegistration complete!');
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});