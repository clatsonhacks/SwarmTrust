import fs from 'fs';
import * as Client from '@storacha/client';
import * as Signer from '@storacha/client/principal/ed25519';
import * as Proof from '@storacha/client/proof';
import { StoreMemory } from '@storacha/client/stores/memory';
import { base64pad } from 'multiformats/bases/base64';

export interface UploadResult {
  cid: string;
  durationMs: number;
  gatewayUrl: string;
}

/**
 * Build a Storacha client from env var credentials.
 * Returns null if the required env vars are not set (uploads silently disabled).
 */
export async function initStorachaClient(
  robotId: string,
  log: { info: (msg: string) => void; warn: (obj: object, msg: string) => void },
): Promise<Client.Client | null> {
  const envSuffix = robotId.toUpperCase().replace(/-/g, '_');
  const agentKey  = process.env[`STORACHA_KEY_${envSuffix}`];
  const proofStr  = process.env[`STORACHA_PROOF_${envSuffix}`];

  if (!agentKey || !proofStr) {
    log.warn({ envSuffix }, 'STORACHA_KEY/PROOF not set — log uploads disabled');
    return null;
  }

  try {
    const principal = Signer.parse(agentKey);
    const store     = new StoreMemory();
    const client    = await Client.create({ principal, store });
    const proof     = await Proof.parse(proofStr);
    const space     = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());
    log.info(`Storacha client ready (space: ${space.did()})`);
    return client;
  } catch (err) {
    log.warn({ err }, 'Storacha client init failed — log uploads disabled');
    return null;
  }
}

/**
 * Upload the agent log file to Storacha.
 * Returns the CID, upload duration, and a public gateway URL.
 */
export async function uploadAgentLog(
  client: Client.Client,
  logFilePath: string,
): Promise<UploadResult> {
  const start   = Date.now();
  const content = fs.readFileSync(logFilePath, 'utf-8');
  const blob    = new Blob([content], { type: 'application/json' });
  const cid     = await client.uploadFile(blob);
  const cidStr  = cid.toString();

  return {
    cid: cidStr,
    durationMs: Date.now() - start,
    gatewayUrl: `https://w3s.link/ipfs/${cidStr}`,
  };
}

/**
 * Upload with one automatic retry after a 3-second wait.
 * Returns null on permanent failure — caller should log and continue.
 */
export async function uploadWithRetry(
  client: Client.Client,
  logFilePath: string,
  log: { warn: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void },
): Promise<UploadResult | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await uploadAgentLog(client, logFilePath);
    } catch (err) {
      if (attempt === 1) {
        log.warn({ err }, 'Storacha upload failed, retrying in 3s');
        await new Promise((r) => setTimeout(r, 3_000));
      } else {
        log.error({ err }, 'Storacha upload failed after retry — skipping');
      }
    }
  }
  return null;
}

// Re-export the key-generation helper so the setup script can stay light
export { base64pad, Signer };
