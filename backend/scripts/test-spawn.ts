/**
 * Quick end-to-end test for spawnRobot().
 * Spawns a scout robot with NAVIGATE + SCAN capabilities.
 * No FAUCET_PRIVATE_KEY needed — funding step is skipped gracefully.
 *
 * Run from backend/: npx tsx scripts/test-spawn.ts
 */
import 'dotenv/config';
import { createRedisClient } from '../src/shared/redis/client.js';
import { spawnRobot } from '../src/spawner/index.js';

async function main() {
  const redis = createRedisClient();
  await redis.connect();
  console.log('[test-spawn] Redis connected');

  console.log('[test-spawn] Spawning scout robot with NAVIGATE + SCAN...');
  const start = Date.now();

  const result = await spawnRobot(redis, ['NAVIGATE', 'SCAN'], 'TestScout-Alpha');

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[test-spawn] Spawn complete in ${elapsed}s`);
  console.log(JSON.stringify(result, null, 2));

  // Verify it registered in Redis
  const stateExists = await redis.exists(`robot:${result.robotId}:state`);
  const configExists = await redis.exists(`robot:${result.robotId}:config`);
  console.log(`\n[test-spawn] Redis state key exists: ${stateExists === 1}`);
  console.log(`[test-spawn] Redis config key exists: ${configExists === 1}`);

  await redis.quit();
  console.log('\n[test-spawn] Done. Robot process is still running in background.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-spawn] FAILED:', err);
  process.exit(1);
});
