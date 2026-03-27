import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // 1. Base Sepolia RPC
  console.log('Testing Base Sepolia RPC...');
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
  const blockNumber = await client.getBlockNumber();
  console.log(`✓ Base Sepolia block number: ${blockNumber}\n`);

  // 2. Redis ping
  console.log('Testing Redis...');
  const redis = new Redis(process.env.REDIS_URL);
  const pong = await redis.ping();
  console.log(`✓ Redis responded: ${pong}\n`);

  redis.disconnect();
}

main().catch((err) => {
  console.error('✗ Failed:', err.message);
  process.exit(1);
});