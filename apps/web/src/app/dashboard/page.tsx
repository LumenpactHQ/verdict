'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import type { ActionRequest, Agent } from '@verdict/shared';
import { MetricCard } from '../../components/MetricCard';
import { DecisionBadge } from '../../components/DecisionBadge';
import { AgentAvatar } from '../../components/AgentAvatar';
import { mockActionRequests } from '../../fixtures/auditLog';
import { mockAgents } from '../../fixtures/agents';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DashboardPage() {
  const [actions, setActions] = useState<ActionRequest[]>(mockActionRequests);
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      // 1. Fetch real action requests from GET /actions
      const actionsRes = await fetch(`${API_BASE_URL}/actions`);
      if (!actionsRes.ok) {
        throw new Error(`API responded with status ${actionsRes.status}: ${actionsRes.statusText}`);
      }
      const actionsData = await actionsRes.json();

      // 2. Fetch registered agents from GET /agents (or fallback to mockAgents for display)
      let agentsData = mockAgents;
      try {
        const agentsRes = await fetch(`${API_BASE_URL}/agents`);
        if (agentsRes.ok) {
          agentsData = await agentsRes.json();
        }
      } catch (agentErr) {
        console.warn('[Dashboard] Could not fetch agents list, using fixtures for labels:', agentErr);
      }

      setActions(Array.isArray(actionsData) && actionsData.length > 0 ? actionsData : mockActionRequests);
      setAgents(Array.isArray(agentsData) && agentsData.length > 0 ? agentsData : mockAgents);
      setIsOffline(false);
    } catch (err: any) {
      console.warn('[Dashboard] Fetch /actions failed, falling back to local fixtures:', err);
      setApiError(`Could not connect to ${API_BASE_URL}. Showing offline fixtures.`);
      setActions(mockActionRequests);
      setAgents(mockAgents);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Aggregate stats derived client-side from actions & agents
  const totalAgents = agents.length || new Set(actions.map((a) => a.agentId)).size;
  const actionsAllowed = actions.filter((a) => a.decision === 'ALLOW').length;
  const actionsRejected = actions.filter((a) => a.decision === 'REJECT').length;
  const pendingReview = actions.filter((a) => a.decision === 'REVIEW').length;

  const getRelativeTime = (timestamp: string) => {
    try {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now.getTime() - time.getTime();
      if (diffMs < 0 || isNaN(diffMs)) {
        // If fixture date is fixed or future, fallback to simple date display
        return 'recent';
      }
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return time.toLocaleDateString();
    } catch {
      return 'recent';
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Security Dashboard</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Active monitoring across autonomous agent permissions and execution gates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOffline ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-950/20 text-xs text-amber-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Offline fixtures</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gate operational (Live API)</span>
            </div>
          )}
          <button
            onClick={() => loadDashboardData()}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-white/10 hover:border-white/20 text-slate-400 hover:text-white transition-all disabled:opacity-50"
            title="Refresh live data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/trust-check"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2f6fed] hover:bg-[#285ec9] text-white shadow-[0_0_16px_-2px_rgba(47,111,237,0.4)] transition-all flex items-center gap-1"
          >
            <span>Simulate action</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total agents"
          value={totalAgents}
          tone="blue"
          icon={<Users className="w-4 h-4" />}
          subtext={isOffline ? "2 verified on Base" : `${agents.filter((a) => a.verificationStatus === 'verified').length} verified on Base`}
        />
        <MetricCard
          label="Actions allowed"
          value={actionsAllowed}
          tone="green"
          icon={<CheckCircle2 className="w-4 h-4" />}
          subtext="100% executed on-chain"
        />
        <MetricCard
          label="Actions rejected"
          value={actionsRejected}
          tone="red"
          icon={<XCircle className="w-4 h-4" />}
          subtext="Zero tx produced"
        />
        <MetricCard
          label="Pending review"
          value={pendingReview}
          tone="amber"
          icon={<Clock className="w-4 h-4" />}
          subtext="Awaiting human sign-off"
        />
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent activity</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live evaluations from registered and autonomous agent requests.
            </p>
          </div>
          <Link
            href="/audit-log"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Full audit trail</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02] text-slate-400">
                <th className="py-3 px-5 font-normal">Agent</th>
                <th className="py-3 px-5 font-normal">Action</th>
                <th className="py-3 px-5 font-normal">Decision</th>
                <th className="py-3 px-5 font-normal">Time</th>
                <th className="py-3 px-5 font-normal text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {actions.slice(0, 8).map((req) => {
                const agent = agents.find((a) => a.id === req.agentId) || mockAgents.find((a) => a.id === req.agentId);
                const agentName = agent ? agent.displayName : req.agentId;

                return (
                  <tr
                    key={req.id}
                    className="hover:bg-white/[0.03] transition-colors group"
                  >
                    <td className="py-3.5 px-5">
                      <Link
                        href={`/agents/${req.agentId}`}
                        className="flex items-center gap-2.5 group-hover:text-white"
                      >
                        <AgentAvatar id={req.agentId} name={agentName} size="sm" />
                        <span className="font-semibold text-slate-200">{agentName}</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-300">
                          {req.actionType} {req.amount} {req.token}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px] truncate max-w-[120px]">
                          to {req.targetAddress.slice(0, 6)}...{req.targetAddress.slice(-4)}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <DecisionBadge status={req.decision} size="sm" showGlow={false} />
                    </td>

                    <td className="py-3.5 px-5 text-slate-400">
                      {getRelativeTime(req.createdAt)}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <Link
                        href={`/trust-check?scenario=${
                          req.agentId === 'agent-alpha'
                            ? 'alpha'
                            : req.agentId === 'agent-shadow'
                            ? 'shadow'
                            : 'sentinel'
                        }`}
                        className="text-xs text-slate-400 hover:text-white font-mono inline-flex items-center gap-1"
                      >
                        <span>Check</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
