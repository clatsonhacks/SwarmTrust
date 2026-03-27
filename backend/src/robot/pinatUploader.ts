import fs from 'fs';

export interface UploadResult {
  cid: string;
  durationMs: number;
  gatewayUrl: string;
}

/**
 * Upload a JSON file to Pinata (IPFS pinning service).
 * Returns the CID, upload duration, and a public gateway URL.
 * Returns null on permanent failure.
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

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const start = Date.now();
      const content = fs.readFileSync(logFilePath, 'utf-8');

      const formData = new FormData();
      formData.append('file', new Blob([content], { type: 'application/json' }), `${logFilePath.split('/').pop()}`);

      const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Pinata HTTP ${res.status}: ${await res.text()}`);
      }

      const json = (await res.json()) as { IpfsHash: string };
      const cid = json.IpfsHash;

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
