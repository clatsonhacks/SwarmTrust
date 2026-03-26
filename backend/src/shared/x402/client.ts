import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { PrivateKeyAccount } from 'viem/accounts';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { toClientEvmSigner } from '@x402/evm';

/**
 * Returns a fetch wrapper that automatically handles the
 * 402 → sign USDC transfer → retry cycle for peer task delegation.
 */
export function makeX402Fetch(account: PrivateKeyAccount) {
  // toClientEvmSigner composes the PrivateKeyAccount (for signing) with a
  // PublicClient (for readContract) into the ClientEvmSigner interface
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });
  const signer = toClientEvmSigner(account, publicClient);

  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: 'eip155:84532', // Base Sepolia
        client: new ExactEvmScheme(signer),
      },
    ],
  });
}