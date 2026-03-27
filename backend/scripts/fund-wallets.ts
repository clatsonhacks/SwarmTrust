/**
 * Fund-wallets helper script.
 * Run: npm run fund-wallets
 *
 * Prints each robot's wallet address and current USDC balance.
 * Go to https://faucet.circle.com, select Base Sepolia, and send
 * USDC to each address shown below. 0.50 USDC per robot is enough
 * for ~50 sub-task delegations in a demo (0.01 USDC each).
 */

import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import { getUsdcBalance, USDC_ADDRESS } from '../src/shared/blockchain/contracts.js';

const ROBOT_CONFIG = [
  { agentId: 'scout-1',   privateKeyEnv: 'ROBOT_1_PRIVATE_KEY' },
  { agentId: 'lifter-2',  privateKeyEnv: 'ROBOT_2_PRIVATE_KEY' },
  { agentId: 'scout-3',   privateKeyEnv: 'ROBOT_3_PRIVATE_KEY' },
  { agentId: 'carrier-4', privateKeyEnv: 'ROBOT_4_PRIVATE_KEY' },
  { agentId: 'lifter-5',  privateKeyEnv: 'ROBOT_5_PRIVATE_KEY' },
];

async function main() {
  console.log('SwarmTrust — Robot Wallet Funding Helper');
  console.log('=========================================');
  console.log(`Network:      Base Sepolia (chain ID 84532)`);
  console.log(`USDC address: ${USDC_ADDRESS}`);
  console.log(`Faucet:       https://faucet.circle.com  (select Base Sepolia)`);
  console.log(`Recommended:  0.50 USDC per robot (~50 delegations @ $0.01 each)\n`);

  for (const { agentId, privateKeyEnv } of ROBOT_CONFIG) {
    const raw = process.env[privateKeyEnv] ?? '';
    const key = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
    const account = privateKeyToAccount(key);

    process.stdout.write(`[${agentId}]  ${account.address}  balance: checking... `);
    try {
      const balance = await getUsdcBalance(account.address);
      const funded = parseFloat(balance) >= 0.5;
      console.log(`${balance} USDC  ${funded ? '✓' : '⚠ needs funding'}`);
    } catch {
      console.log('(RPC error — check BASE_SEPOLIA_RPC_URL)');
    }
  }

  console.log('\nAfter funding, re-run this script to confirm balances.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});