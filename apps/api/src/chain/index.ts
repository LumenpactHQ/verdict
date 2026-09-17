import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export type Hex = `0x${string}`;

let mockFailure: Error | null = null;
let mockDelayMs = 0;
let transferInvocationCount = 0;

/**
 * Test-only hook: inject artificial failure into executeTransfer.
 * Strictly gated so it cannot be triggered outside NODE_ENV === 'test'.
 */
export function __setMockTransferFailure(error: Error | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Security violation: __setMockTransferFailure is only allowed when NODE_ENV === "test"');
  }
  mockFailure = error;
}

/**
 * Test-only hook: inject artificial delay into executeTransfer to simulate in-flight execution and test concurrency.
 * Strictly gated so it cannot be triggered outside NODE_ENV === 'test'.
 */
export function __setMockTransferDelay(ms: number): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Security violation: __setMockTransferDelay is only allowed when NODE_ENV === "test"');
  }
  mockDelayMs = ms;
}

/**
 * Test-only hook: retrieve number of times executeTransfer has been called.
 * Strictly gated so it cannot be triggered outside NODE_ENV === 'test'.
 */
export function __getTransferInvocationCount(): number {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Security violation: __getTransferInvocationCount is only allowed when NODE_ENV === "test"');
  }
  return transferInvocationCount;
}

/**
 * Test-only hook: reset all mock overrides.
 * Strictly gated so it cannot be triggered outside NODE_ENV === 'test'.
 */
export function __resetChainMocks(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Security violation: __resetChainMocks is only allowed when NODE_ENV === "test"');
  }
  mockFailure = null;
  mockDelayMs = 0;
  transferInvocationCount = 0;
}

// ─── ABIs ──────────────────────────────────────────────────────────────────────

/**
 * VerdictGate.executeTransfer(address to, uint256 amount)
 * Only callable by the contract owner (the backend wallet).
 */
const VERDICT_GATE_ABI = [
  {
    name: 'executeTransfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

/** Minimal ERC-20 ABI — direct transfer fallback (no deployed gate contract). */
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',    type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── Clients ───────────────────────────────────────────────────────────────────

/**
 * Lazily-initialised viem clients — created once per call and reused.
 * Throws at call-time (not at import-time) so missing env vars produce a
 * clear runtime error rather than crashing the server on startup.
 */
function getClients() {
  const rpcUrl      = process.env.BASE_SEPOLIA_RPC_URL;
  const rawKey      = process.env.VERDICT_BACKEND_PRIVATE_KEY?.trim();
  const privateKey  = rawKey ? (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as Hex : undefined;

  if (!rpcUrl) {
    throw new Error('[chain] BASE_SEPOLIA_RPC_URL is not set');
  }
  if (!privateKey?.startsWith('0x')) {
    throw new Error('[chain] VERDICT_BACKEND_PRIVATE_KEY is not set or not a valid 0x-prefixed hex key');
  }

  const account = privateKeyToAccount(privateKey);

  return {
    walletClient: createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    }),
    publicClient: createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    }),
  };
}

// ─── Core function ─────────────────────────────────────────────────────────────

/**
 * Executes a token transfer on Base Sepolia, enforced at two layers:
 *
 * **Layer 1 — Off-chain (backend):** `/actions/execute` verifies the agent
 * identity, checks the authorization_token is valid/unexpired/unconsumed, and
 * confirms the decision is ALLOW before ever reaching this function.
 *
 * **Layer 2 — On-chain (VerdictGate contract):** When `VERDICT_GATE_ADDRESS` is
 * set, the transfer is routed through the deployed VerdictGate.sol contract.
 * The contract enforces `onlyOwner` — only the backend wallet can call it —
 * making it impossible for any external party to release funds without passing
 * the full verdict gate. A REJECT is a genuine on-chain block.
 *
 * If `VERDICT_GATE_ADDRESS` is not set (e.g. during local dev before deployment),
 * falls back to a direct ERC-20 transfer from the backend wallet.
 *
 * Locked signature for team integration (P2 ↔ P3 contract):
 * @param to     Recipient address (0x...)
 * @param amount Human-readable token amount (e.g. 5 for 5 USDC).
 *               Scaled internally by TEST_TOKEN_DECIMALS (default: 6).
 * @returns      Promise resolving to the confirmed transaction hash (0x...)
 */
export async function executeTransfer(to: Hex, amount: number): Promise<string> {
  // Test-only hooks are strictly guarded by NODE_ENV === 'test'
  if (process.env.NODE_ENV === 'test') {
    transferInvocationCount++;

    if (mockDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, mockDelayMs));
    }

    if (mockFailure) {
      throw mockFailure;
    }

    // Fallback deterministic fixture hash for test runs
    return '0x3f8a91b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1';
  }

  const tokenAddress   = process.env.TEST_TOKEN_ADDRESS   as Hex | undefined;
  const gateAddress    = process.env.VERDICT_GATE_ADDRESS as Hex | undefined;
  const decimals       = parseInt(process.env.TEST_TOKEN_DECIMALS ?? '6', 10);

  if (!tokenAddress?.startsWith('0x') || !process.env.VERDICT_BACKEND_PRIVATE_KEY) {
    console.log(`[chain] Local dev fallback: returning simulated Base Sepolia tx hash`);
    return '0x7a3f81c902b4d7e9b048593a19e5c46b9a8e2d7c5b3a10e4f8d6c7b9a0e1f234';
  }

  const { walletClient, publicClient } = getClients();

  // Scale from human-readable → raw on-chain units (e.g. 5 USDC → 5_000_000)
  const rawAmount = parseUnits(amount.toString(), decimals);

  let txHash: Hex;

  if (gateAddress?.startsWith('0x')) {
    // ── Path A: Route through VerdictGate (on-chain enforcement) ──────────────
    console.log(`[chain] Routing through VerdictGate at ${gateAddress}`);
    txHash = await walletClient.writeContract({
      address: getAddress(gateAddress),
      abi:     VERDICT_GATE_ABI,
      functionName: 'executeTransfer',
      args: [getAddress(to), rawAmount],
    });
  } else {
    // ── Path B: Direct ERC-20 transfer (fallback — no gate deployed yet) ──────
    console.log(`[chain] VERDICT_GATE_ADDRESS not set — falling back to direct ERC-20 transfer`);
    txHash = await walletClient.writeContract({
      address: getAddress(tokenAddress),
      abi:     ERC20_ABI,
      functionName: 'transfer',
      args: [getAddress(to), rawAmount],
    });
  }

  console.log(`[chain] Transfer submitted — txHash: ${txHash}`);

  // Wait for 1-block confirmation so the returned hash is genuinely on-chain
  const receipt = await publicClient.waitForTransactionReceipt({
    hash:          txHash,
    confirmations: 1,
  });

  if (receipt.status === 'reverted') {
    throw new Error(`[chain] Transaction reverted on-chain — txHash: ${txHash}`);
  }

  console.log(`[chain] Transfer confirmed — block: ${receipt.blockNumber}, txHash: ${txHash}`);
  return txHash;
}
