'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Coins,
  Shield,
} from 'lucide-react';
import { mockAgents } from '../../fixtures/agents';
import { AgentAvatar } from '../../components/AgentAvatar';

export default function AgentsDirectoryPage() {
  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Agent Passports
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Registered autonomous agents on Base Sepolia with active security gate permission profiles.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-950/20 text-xs text-indigo-300 font-mono">
          <Shield className="w-3.5 h-3.5" />
          <span>{mockAgents.length} Agents Registered</span>
        </div>
      </div>

      {/* Agents Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {mockAgents.map((agent) => {
          const isVerified = agent.verificationStatus === 'verified';
          const reputationScore =
            agent.verificationStatus === 'verified'
              ? agent.id === 'agent-alpha'
                ? 98
                : 84
              : 24;

          return (
            <div
              key={agent.id}
              className="glass-panel p-6 flex flex-col justify-between space-y-5 hover:border-white/20 transition-all group"
            >
              <div className="space-y-4">
                {/* Agent Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <AgentAvatar id={agent.id} name={agent.displayName} size="lg" />
                    <div>
                      <h2 className="text-base font-semibold text-white group-hover:text-indigo-200 transition-colors">
                        {agent.displayName}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1 ${
                          isVerified
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isVerified ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                        <span>{isVerified ? 'Verified' : 'Unverified'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Reputation badge */}
                  <div
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border ${
                      reputationScore >= 80
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    Score: {reputationScore}
                  </div>
                </div>

                {/* Wallet Address */}
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                    Wallet address
                  </span>
                  <div className="flex items-center justify-between font-mono text-xs text-slate-300 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2">
                    <span className="truncate max-w-[180px]">
                      {agent.walletAddress}
                    </span>
                    <a
                      href={`https://sepolia.basescan.org/address/${agent.walletAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-white transition-colors"
                      title="View on Base Sepolia"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                    Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.length > 0 ? (
                      agent.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08]"
                        >
                          {cap}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-rose-400 font-mono">
                        None declared (Blocked)
                      </span>
                    )}
                  </div>
                </div>

                {/* Limits */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>Max limit:</span>
                  </span>
                  <span className="font-semibold text-white font-mono">
                    {agent.transactionLimit} USDC
                  </span>
                </div>
              </div>

              {/* View Passport CTA */}
              <Link
                href={`/agents/${agent.id}`}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                <span>View Full Passport</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
