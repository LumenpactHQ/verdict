'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  ExternalLink,
  ArrowUpRight,
} from 'lucide-react';
import { mockAgents } from '../../../fixtures/agents';
import { mockActionRequests } from '../../../fixtures/auditLog';
import { AgentAvatar } from '../../../components/AgentAvatar';
import { DecisionBadge } from '../../../components/DecisionBadge';

interface AgentPassportPageProps {
  params: {
    id: string;
  };
}

export default function AgentPassportPage({ params }: AgentPassportPageProps) {
  const [copied, setCopied] = useState(false);

  // Lookup agent or fallback to first
  const agent = mockAgents.find((a) => a.id === params.id) || mockAgents[0];
  const agentHistory = mockActionRequests.filter((req) => req.agentId === agent.id);

  // Compute reputation score deterministically
  const reputationScore =
    agent.verificationStatus === 'verified'
      ? agent.id === 'agent-alpha'
        ? 98
        : 84
      : 24;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(agent.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isVerified = agent.verificationStatus === 'verified';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Back button */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to dashboard</span>
        </Link>
      </div>

      {/* Header Card */}
      <div className="glass-panel p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <AgentAvatar id={agent.id} name={agent.displayName} size="xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white tracking-tight">
                  {agent.displayName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    isVerified
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {isVerified ? (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>{isVerified ? 'Verified' : 'Unverified'}</span>
                </span>
              </div>

              {/* Monospace Address with Copy */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>{agent.walletAddress}</span>
                <button
                  onClick={handleCopy}
                  className="p-1 hover:text-white transition-colors"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={`https://sepolia.basescan.org/address/${agent.walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white"
                  title="View on Base Sepolia"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/trust-check?scenario=${
                agent.id === 'agent-alpha'
                  ? 'alpha'
                  : agent.id === 'agent-shadow'
                  ? 'shadow'
                  : 'sentinel'
              }`}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-[#2f6fed] hover:bg-[#285ec9] text-white shadow-[0_0_16px_-2px_rgba(47,111,237,0.4)] transition-all flex items-center gap-1.5"
            >
              <span>Test agent gate</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Capabilities */}
        <div className="glass-panel p-5 md:col-span-2 space-y-2">
          <span className="text-[13px] text-slate-400">Declared capabilities</span>
          <div className="flex flex-wrap gap-2 pt-1">
            {agent.capabilities.length > 0 ? (
              agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.05] text-slate-200 border border-white/[0.08]"
                >
                  {cap}
                </span>
              ))
            ) : (
              <span className="text-xs text-rose-400/90 font-mono">
                No capabilities declared (strict policy block)
              </span>
            )}
          </div>
        </div>

        {/* Transaction Limits */}
        <div className="glass-panel p-5 space-y-1">
          <span className="text-[13px] text-slate-400">Policy bounds</span>
          <div className="pt-1">
            <span className="text-xl font-semibold text-white">
              {agent.transactionLimit} USDC
            </span>
            <span className="text-xs text-slate-500 block">Maximum limit</span>
          </div>
          <div className="text-xs text-amber-400/90 pt-1 font-mono">
            {agent.reviewThreshold} USDC review soft cap
          </div>
        </div>

        {/* Reputation Score Radial */}
        <div className="glass-panel p-5 flex flex-col justify-between">
          <span className="text-[13px] text-slate-400">Reputation score</span>
          <div className="flex items-center gap-3 pt-1">
            <div
              className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-semibold text-base ${
                reputationScore >= 80
                  ? 'border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                  : 'border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
              }`}
            >
              {reputationScore}
            </div>
            <div className="text-xs text-slate-400">
              <span>{reputationScore >= 80 ? 'High trust' : 'High risk'}</span>
              <span className="block text-[11px] text-slate-500">Base on-chain</span>
            </div>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white">Action history</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Previous security gate evaluations and verdicts for this agent.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-slate-400">
                <th className="py-3 px-5 font-normal">Action</th>
                <th className="py-3 px-5 font-normal">Target address</th>
                <th className="py-3 px-5 font-normal">Verdict</th>
                <th className="py-3 px-5 font-normal">Status</th>
                <th className="py-3 px-5 font-normal">Tx hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {agentHistory.length > 0 ? (
                agentHistory.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-5 font-mono text-slate-200">
                      {req.actionType} {req.amount} {req.token}
                    </td>
                    <td className="py-3 px-5 font-mono text-slate-400">
                      {req.targetAddress.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-5">
                      <DecisionBadge status={req.decision} size="sm" showGlow={false} />
                    </td>
                    <td className="py-3 px-5 text-slate-400 font-mono text-[11px]">
                      {req.status}
                    </td>
                    <td className="py-3 px-5 font-mono text-[11px] text-[#2f6fed]">
                      {req.txHash ? (
                        <a
                          href={`https://sepolia.basescan.org/tx/${req.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          <span>{req.txHash.slice(0, 8)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    No past transactions recorded for this agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
