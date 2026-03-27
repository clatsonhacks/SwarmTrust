import fs from 'fs';
import { PinataSDK } from 'pinata';

export interface UploadResult {
  cid: string;
  durationMs: number;
  gatewayUrl: string;
}

/**
 * Upload a JSON file to Pinata (IPFS pinning service) using the Pinata SDK.
 * Returns the CID, upload duration, and a public gateway URL.
 * Returns null on permanent failure — non-fatal, robot continues.
 */
export async function uploadLogToPinata(
  logFilePath: string,
  log: { warn: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void },
): Promise<UploadResult | null> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    log.warn({}, 'PINATA_JWT not set — log upload disabled');
    return null;
  }

  const pinata = new PinataSDK({ pinataJwt: jwt });
  const fileName = logFilePath.split('/').pop() ?? 'agent-log.json';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const start = Date.now();
      const content = fs.readFileSync(logFilePath, 'utf-8');
      const blob = new Blob([content], { type: 'application/json' });
      const file = new File([blob], fileName, { type: 'application/json' });

      const result = await pinata.upload.public.file(file);
      const cid = result.cid;

      return {
        cid,
        durationMs: Date.now() - start,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      };
    } catch (err) {
      if (attempt === 1) {
        log.warn({ err }, 'Pinata upload failed, retrying in 3s');
        await new Promise((r) => setTimeout(r, 3_000));
      } else {
        log.error({ err }, 'Pinata upload failed after retry — skipping');
      }
    }
  }
  return null;
}
