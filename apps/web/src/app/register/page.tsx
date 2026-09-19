'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { VerificationStatus } from '@verdict/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://verdict-engine-api.fly.dev';

export default function RegisterAgentPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('verified');
  const [capabilities, setCapabilities] = useState<string[]>(['payment', 'transfer']);
  const [transactionLimit, setTransactionLimit] = useState<number>(500);
  const [reviewThreshold, setReviewThreshold] = useState<number>(100);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAddress = () => {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    setWalletAddress(addr);
  };

  const toggleCapability = (cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    if (!walletAddress.trim() || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      setError('A valid 42-character 0x EVM wallet address is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        displayName: displayName.trim(),
        walletAddress: walletAddress.trim().toLowerCase(),
        verificationStatus,
        capabilities,
        transactionLimit: Number(transactionLimit),
        reviewThreshold: Number(reviewThreshold),
      };

      const res = await fetch(`${API_BASE_URL}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Registration failed with status ${res.status}`);
      }

      const createdAgent = await res.json();

      // Store in localStorage for quick discovery on trust check
      if (typeof window !== 'undefined') {
        const customAgents = JSON.parse(localStorage.getItem('verdict_custom_agents') || '[]');
        customAgents.push(createdAgent);
        localStorage.setItem('verdict_custom_agents', JSON.stringify(customAgents));
      }

      // Route directly to Trust Check with new agent selected
      router.push(`/trust-check?customAgentId=${createdAgent.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to register agent');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6d5bff] mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Self-service agent onboarding</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Register Autonomous Agent
        </h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Add a custom agent to the live Verdict database and immediately test its policy boundaries on Base Sepolia.
        </p>
      </div>

      {/* Guardrail Banner */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 ring-1 ring-cyan-500/20 shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-cyan-300">Shared Testnet Wallet Guardrail</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Evaluation logic is 100% authentic and runs through the real deterministic rule engine. To protect the shared faucet wallet from being drained, on-chain execution (<code className="rounded bg-slate-900 px-1 py-0.5 text-cyan-300">/actions/execute</code>) is strictly reserved for the 3 demo agents.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Registration Error</span>
          </div>
          <p className="mt-1 text-xs text-rose-200/80">{error}</p>
        </div>
      )}

      {/* Registration Form Card */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 space-y-6">
        {/* Display Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Apex Liquidity Arbitrageur"
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        {/* Wallet Address */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              EVM Wallet Address
            </label>
            <button
              type="button"
              onClick={handleGenerateAddress}
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Generate Random</span>
            </button>
          </div>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            className="mt-2 w-full font-mono text-sm rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        {/* Verification Status */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Verification Status
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVerificationStatus('verified')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                verificationStatus === 'verified'
                  ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Verified (On-chain)</span>
            </button>
            <button
              type="button"
              onClick={() => setVerificationStatus('unverified')}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                verificationStatus === 'unverified'
                  ? 'border-rose-500/50 bg-rose-950/30 text-rose-300 ring-1 ring-rose-500/30'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Unverified</span>
            </button>
          </div>
        </div>

        {/* Declared Capabilities */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Declared Capabilities
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Select what actions this agent is cryptographically permitted to perform.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['transfer', 'payment', 'swap'].map((cap) => {
              const active = capabilities.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCapability(cap)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm shadow-cyan-500/10'
                      : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/10 hover:text-slate-200'
                  }`}
                >
                  {cap} {active && '✓'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Limits & Thresholds */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Hard Limit (USDC)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={transactionLimit}
              onChange={(e) => setTransactionLimit(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <span className="mt-1 text-[11px] text-slate-500">Transfers exceeding this are strictly REJECTED.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Soft Review Threshold (USDC)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={reviewThreshold}
              onChange={(e) => setReviewThreshold(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <span className="mt-1 text-[11px] text-slate-500">Transfers exceeding this trigger human REVIEW.</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Registering in SQLite...</span>
            </>
          ) : (
            <>
              <span>Register & Test in Trust Check</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
