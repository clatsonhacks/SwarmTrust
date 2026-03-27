/**
 * One-time Storacha credential generator.
 *
 * Usage:
 *   cd backend
 *   npx tsx src/scripts/setup-storacha.ts
 *
 * What it does:
 *   - Generates an Ed25519 agent keypair for each robot
 *   - Prints the env vars to add to .env
 *   - Prints the CLI command to run for each delegation proof
 *
 * After running this script:
 *   1. Copy the STORACHA_KEY_* lines into .env
 *   2. Log in to Storacha: npx @storacha/cli login <email>
 *   3. Create one space per robot:
 *        npx @storacha/cli space create scout-1
 *        ... (repeat for each robot)
 *   4. For each robot, run the printed delegation command (with the space active)
 *   5. Copy the STORACHA_PROOF_* output into .env
 */

import * as Signer from '@storacha/client/principal/ed25519';
import { base64pad } from 'multiformats/bases/base64';

const ROBOTS = ['scout-1', 'lifter-2', 'scout-3', 'carrier-4', 'lifter-5'] as const;

console.log('# ─── Storacha Agent Keys ───────────────────────────────────────');
console.log('# Add these to backend/.env');
console.log('#');
console.log('# Then create delegation proofs with the @storacha/cli:');
console.log('#   npx @storacha/cli login <your-email>');
console.log('#   npx @storacha/cli space create <robot-id>');
console.log('#   npx @storacha/cli space use <space-did>');
console.log('#   npx @storacha/cli delegation create <agent-did> \\');
console.log('#     --can "space/blob/add" --can "space/index/add" \\');
console.log('#     --can "upload/add" --can "filecoin/offer" --base64');
console.log();

for (const robotId of ROBOTS) {
  const kp = await Signer.generate();
  const keyStr = base64pad.encode(kp.encode() as unknown as Uint8Array);
  const envSuffix = robotId.toUpperCase().replace(/-/g, '_');

  console.log(`# ── ${robotId} ──`);
  console.log(`STORACHA_KEY_${envSuffix}=${keyStr}`);
  console.log(`# agent DID: ${kp.did()}`);
  console.log(`# delegation command:`);
  console.log(`#   npx @storacha/cli space use <${robotId}-space-did>`);
  console.log(`#   npx @storacha/cli delegation create ${kp.did()} --can "space/blob/add" --can "space/index/add" --can "upload/add" --base64`);
  console.log(`STORACHA_PROOF_${envSuffix}=<paste --base64 output here>`);
  console.log();
}
