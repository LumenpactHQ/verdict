'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import type { Decision } from '@verdict/shared';
import { mockActionRequests } from '../../fixtures/auditLog';
import { mockAgents } from '../../fixtures/agents';
import { DecisionBadge } from '../../components/DecisionBadge';
import { AgentAvatar } from '../../components/AgentAvatar';

export default function AuditLogPage() {
  const [filter, setFilter] = useState<'ALL' | Decision>('ALL');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const filteredRequests = mockActionRequests.filter((req) => {
    if (filter === 'ALL') return true;
    return req.decision === filter;
  });

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Security Audit Log</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Immutable, append-only log of pre-action checks, verdicts, and on-chain execution states.
          </p>
        </div>

        {/* Filter Pill Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl glass-panel-subtle border-white/10">
          {(['ALL', 'ALLOW', 'REVIEW', 'REJECT'] as const).map((opt) => {
            const isSelected = filter === opt;
            return (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? opt === 'ALLOW'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : opt === 'REJECT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : opt === 'REVIEW'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-white/15 text-white border border-white/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt === 'ALL' ? 'All' : opt === 'ALLOW' ? 'Allow' : opt === 'REVIEW' ? 'Review' : 'Reject'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto max-h-[650px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-20 bg-[#070b14] border-b border-white/[0.08] backdrop-blur-md">
              <tr className="text-slate-400">
                <th className="py-3 px-5 font-normal">Timestamp</th>
                <th className="py-3 px-5 font-normal">Agent</th>
                <th className="py-3 px-5 font-normal">Action type</th>
                <th className="py-3 px-5 font-normal">Amount</th>
                <th className="py-3 px-5 font-normal">Verdict</th>
                <th className="py-3 px-5 font-normal">Reasons</th>
                <th className="py-3 px-5 font-normal">Tx hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => {
                  const agent = mockAgents.find((a) => a.id === req.agentId);
                  const agentName = agent ? agent.displayName : req.agentId;
                  const isExpanded = expandedRowId === req.id;

                  return (
                    <React.Fragment key={req.id}>
                      <tr
                        onClick={() => toggleRow(req.id)}
                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-5 font-mono text-slate-400">
                          {formatTimestamp(req.createdAt)}
                        </td>

                        <td className="py-3.5 px-5">
                          <Link
                            href={`/agents/${req.agentId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 group-hover:text-white"
                          >
                            <AgentAvatar id={req.agentId} name={agentName} size="sm" />
                            <span className="font-semibold text-slate-200">{agentName}</span>
                          </Link>
                        </td>

                        <td className="py-3.5 px-5 font-mono text-slate-300">
                          {req.actionType}
                        </td>

                        <td className="py-3.5 px-5 font-mono text-slate-200">
                          {req.amount} {req.token}
                        </td>

                        <td className="py-3.5 px-5">
                          <DecisionBadge status={req.decision} size="sm" showGlow={false} />
                        </td>

                        <td className="py-3.5 px-5 text-slate-300 max-w-xs truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{req.reasons[0]}</span>
                            {req.reasons.length > 1 || req.reasons[0].length > 35 ? (
                              isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )
                            ) : null}
                          </div>
                        </td>

                        <td className="py-3.5 px-5 font-mono text-[11px] text-[#2f6fed]">
                          {req.txHash ? (
                            <a
                              href={`https://sepolia.basescan.org/tx/${req.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
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

                      {/* Expandable reasons row */}
                      {isExpanded && (
                        <tr className="bg-white/[0.02]">
                          <td colSpan={7} className="py-3 px-5 border-t border-white/[0.04]">
                            <div className="space-y-1.5 pl-6 border-l-2 border-[#2f6fed]/50">
                              <span className="text-[11px] text-slate-400 block">
                                Full evaluation reasons:
                              </span>
                              {req.reasons.map((r, i) => (
                                <p key={i} className="text-xs text-slate-300 font-mono">
                                  • {r}
                                </p>
                              ))}
                              {req.authorizationToken && (
                                <p className="text-[11px] text-emerald-400/90 font-mono pt-1">
                                  Auth token: {req.authorizationToken} (single-use, consumed)
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                    No action records found matching the selected filter.
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
