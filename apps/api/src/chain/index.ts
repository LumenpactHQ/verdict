import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  getAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

export type Hex = `0x${string}`;

let mockFailure: Error | null = null;
let mockDelayMs = 0;
let transferInvocationCount = 0;
let mockCallback: (() => Promise<void> | void) | null = null;

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
 * Test-only hook: execute arbitrary callback during executeTransfer (e.g. to test mid-flight DB state changes).
 * Strictly gated so it cannot be triggered outside NODE_ENV === 'test'.
 */
export function __setMockTransferCallback(cb: (() => Promise<void> | void) | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Security violation: __setMockTransferCallback is only allowed when NODE_ENV === "test"');
  }
  mockCallback = cb;
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
  mockCallback = null;
  transferInvocationCount = 0;
}

// ─── Custom Errors ─────────────────────────────────────────────────────────────

export type ChainErrorCode =
  | 'INSUFFICIENT_USDC'
  | 'INSUFFICIENT_GAS'
  | 'SIMULATION_FAILED'
  | 'CHAIN_EXECUTION_FAILED';

export class PreflightError extends Error {
  code: ChainErrorCode;
  sender: string;
  balance?: number;
  required?: number;
  rawError?: string;

  constructor(options: {
    message: string;
    code: ChainErrorCode;
    sender: string;
    balance?: number;
    required?: number;
    rawError?: string;
  }) {
    super(options.message);
    this.name = 'PreflightError';
    this.code = options.code;
    this.sender = options.sender;
    this.balance = options.balance;
    this.required = options.required;
    this.rawError = options.rawError;
  }
}

// ─── Default Constants ─────────────────────────────────────────────────────────

/** Circle native USDC contract on Base Sepolia (6 decimals) */
export const USDC_BASE_SEPOLIA_ADDRESS: Hex = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_DECIMALS = 6;

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

/** Minimal ERC-20 ABI — transfer and balanceOf for Base Sepolia test tokens */
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
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ─── Account & Client Helpers ──────────────────────────────────────────────────

/**
 * Derives and returns the Viem Account from VERDICT_BACKEND_PRIVATE_KEY.
 * Returns null if the env variable is missing or malformed.
 */
export function getBackendAccount() {
  let rawKey = process.env.VERDICT_BACKEND_PRIVATE_KEY?.trim() || '';
  // Strip enclosing quotes, escaped quotes, or backslashes that might be introduced by container env injection
  rawKey = rawKey.replace(/^["'\\]+|["'\\]+$/g, '').trim();
  if (!rawKey) return null;

  const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as Hex;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return null;
  }

  try {
    return privateKeyToAccount(privateKey);
  } catch {
    return null;
  }
}

/**
 * Returns the derived sender address (account.address) for the backend wallet, or null if unconfigured.
 */
export function getSenderAddress(): Hex | null {
  const account = getBackendAccount();
  return account ? (account.address as Hex) : null;
}

/**
 * Lazily-initialised viem clients.
 * Throws at call-time (not at import-time) so missing env vars produce a
 * clear runtime error rather than crashing the server on startup.
 */
function getClients() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const account = getBackendAccount();

  if (!process.env.BASE_SEPOLIA_RPC_URL) {
    throw new Error('[chain] BASE_SEPOLIA_RPC_URL is not set');
  }
  if (!account) {
    const rawKey = process.env.VERDICT_BACKEND_PRIVATE_KEY?.trim() || '';
    throw new Error(
      `[chain] VERDICT_BACKEND_PRIVATE_KEY is invalid: expected 64 hex characters (received length ${rawKey.length})`
    );
  }

  return {
    account,
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
 * **Preflight Verification:**
 * - Verifies sender has non-zero ETH balance for gas.
 * - Reads USDC balanceOf(sender) on Base Sepolia (0x036CbD53842c5426634e7929541eC2318f3dCF7e).
 * - If balance < amount, rejects preflight before sending tx.
 * - Uses simulateContract before writeContract to intercept any revert.
 *
 * **Layer 2 — On-chain (VerdictGate contract):** When `VERDICT_GATE_ADDRESS` is
 * set, the transfer is routed through the deployed VerdictGate.sol contract.
 *
 * If `VERDICT_GATE_ADDRESS` is not set (Option A default demo mode),
 * falls back to a direct ERC-20 transfer from the backend wallet.
 *
 * Locked signature for team integration (P2 ↔ P3 contract):
 * @param to     Recipient address (0x...)
 * @param amount Human-readable token amount (e.g. 0.5 for 0.5 USDC).
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

    if (mockCallback) {
      await mockCallback();
    }

    // Fallback deterministic fixture hash for test runs
    return '0x3f8a91b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1';
  }

  const tokenAddress = (process.env.TEST_TOKEN_ADDRESS as Hex | undefined) || USDC_BASE_SEPOLIA_ADDRESS;
  const gateAddress  = process.env.VERDICT_GATE_ADDRESS as Hex | undefined;
  const decimals     = parseInt(process.env.TEST_TOKEN_DECIMALS ?? '6', 10);

  if (!tokenAddress?.startsWith('0x') || !process.env.VERDICT_BACKEND_PRIVATE_KEY) {
    throw new Error(
      'Configuration error: TEST_TOKEN_ADDRESS or VERDICT_BACKEND_PRIVATE_KEY missing for on-chain transfer execution'
    );
  }

  const { account, walletClient, publicClient } = getClients();

  // ── Preflight Check 1: Gas balance ──────────────────────────────────────────
  const ethBalanceWei = await publicClient.getBalance({ address: account.address });
  if (ethBalanceWei === 0n) {
    console.warn(`[chain] Preflight check failed: Sender ${account.address} has 0 ETH for gas`);
    throw new PreflightError({
      code: 'INSUFFICIENT_GAS',
      sender: account.address,
      message: `Sender wallet (${account.address}) has 0 ETH for gas on Base Sepolia.`,
    });
  }

  // ── Preflight Check 2: Token balance ────────────────────────────────────────
  const rawBalance = await publicClient.readContract({
    address: getAddress(tokenAddress),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  const rawAmount = parseUnits(amount.toString(), decimals);
  const humanBalance = Number(formatUnits(rawBalance, decimals));

  if (rawBalance < rawAmount) {
    console.warn(
      `[chain] Preflight check failed: Sender ${account.address} has ${humanBalance} USDC, but requires ${amount} USDC`
    );
    throw new PreflightError({
      code: 'INSUFFICIENT_USDC',
      sender: account.address,
      balance: humanBalance,
      required: amount,
      message: `Sender wallet has ${humanBalance} USDC but needs ${amount} USDC.`,
    });
  }

  let txHash: Hex;

  // ── Preflight Check 3: simulateContract before writeContract ────────────────
  if (gateAddress?.startsWith('0x')) {
    // ── Path A: Route through VerdictGate (on-chain enforcement) ──────────────
    console.log(`[chain] Simulating transfer through VerdictGate at ${gateAddress}...`);
    let simulationRequest;
    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: getAddress(gateAddress),
        abi: VERDICT_GATE_ABI,
        functionName: 'executeTransfer',
        args: [getAddress(to), rawAmount],
      });
      simulationRequest = request;
    } catch (simErr: any) {
      console.error('[chain] simulateContract failed for VerdictGate:', simErr);
      const rawError = simErr instanceof Error ? simErr.message : String(simErr);
      if (
        rawError.includes('transfer amount exceeds balance') ||
        rawError.includes('InsufficientContractBalance')
      ) {
        throw new PreflightError({
          code: 'INSUFFICIENT_USDC',
          sender: account.address,
          balance: humanBalance,
          required: amount,
          rawError,
          message: `Sender wallet has ${humanBalance} USDC but needs ${amount} USDC.`,
        });
      }
      throw new PreflightError({
        code: 'SIMULATION_FAILED',
        sender: account.address,
        rawError,
        message: `Simulation reverted before broadcast: ${simErr?.shortMessage || rawError}`,
      });
    }

    console.log(`[chain] Simulation passed. Broadcasting via VerdictGate...`);
    txHash = await walletClient.writeContract(simulationRequest);
  } else {
    // ── Path B: Direct ERC-20 transfer (fallback — no gate deployed yet) ──────
    console.log(`[chain] Simulating direct ERC-20 transfer on ${tokenAddress}...`);
    let simulationRequest;
    try {
      const { request } = await publicClient.simulateContract({
        account,
        address: getAddress(tokenAddress),
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [getAddress(to), rawAmount],
      });
      simulationRequest = request;
    } catch (simErr: any) {
      console.error('[chain] simulateContract failed for direct ERC-20 transfer:', simErr);
      const rawError = simErr instanceof Error ? simErr.message : String(simErr);
      if (rawError.includes('transfer amount exceeds balance')) {
        throw new PreflightError({
          code: 'INSUFFICIENT_USDC',
          sender: account.address,
          balance: humanBalance,
          required: amount,
          rawError,
          message: `Sender wallet has ${humanBalance} USDC but needs ${amount} USDC.`,
        });
      }
      throw new PreflightError({
        code: 'SIMULATION_FAILED',
        sender: account.address,
        rawError,
        message: `Simulation reverted before broadcast: ${simErr?.shortMessage || rawError}`,
      });
    }

    console.log(`[chain] Simulation passed. Broadcasting direct ERC-20 transfer...`);
    txHash = await walletClient.writeContract(simulationRequest);
  }

  console.log(`[chain] Transfer submitted — txHash: ${txHash}`);

  // Wait for 1-block confirmation so the returned hash is genuinely on-chain
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  if (receipt.status === 'reverted') {
    throw new Error(`[chain] Transaction reverted on-chain — txHash: ${txHash}`);
  }

  console.log(`[chain] Transfer confirmed — block: ${receipt.blockNumber}, txHash: ${txHash}`);
  return txHash;
}
