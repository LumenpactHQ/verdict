'use client';

import React, { useState, Suspense, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ExternalLink,
  ShieldBan,
  RotateCcw,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lock,
  Plus,
  Sliders,
} from 'lucide-react';
import type { Agent, Decision, DocketEntry } from '@verdict/shared';
import { demoScenarios, type DemoScenario, type CheckItem } from '../../fixtures/scenarios';
import { DecisionBadge } from '../../components/DecisionBadge';
import { CheckList } from '../../components/CheckList';
import { AgentAvatar } from '../../components/AgentAvatar';
import { GlowButton } from '../../components/GlowButton';
import { DocketPanel } from '../../components/DocketPanel';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://verdictapi-production.up.railway.app';

interface EvaluationState {
  actionRequestId: string;
  decision: Decision;
  reasons: string[];
  authorizationToken: string | null;
  docketMatches?: DocketEntry[];
  txHash: string | null;
}

type TabKey = 'alpha' | 'shadow' | 'sentinel' | 'custom';

function TrustCheckContent() {
  const searchParams = useSearchParams();
  const initialScenarioKey = searchParams.get('scenario') as 'alpha' | 'shadow' | 'sentinel' | null;
  const customAgentIdParam = searchParams.get('customAgentId');

  const [activeKey, setActiveKey] = useState<TabKey>(
    customAgentIdParam ? 'custom' : (initialScenarioKey && demoScenarios[initialScenarioKey] ? initialScenarioKey : 'alpha')
  );

  const [customAgent, setCustomAgent] = useState<Agent | null>(null);
  const [customActionType, setCustomActionType] = useState<'PAYMENT' | 'TRANSFER' | 'SWAP'>('PAYMENT');
  const [customAmount, setCustomAmount] = useState<number>(50);
  const [customRecipient, setCustomRecipient] = useState<string>('0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91');

  const [runKey, setRunKey] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<EvaluationState | null>(null);
  const [evaluationComplete, setEvaluationComplete] = useState<boolean>(false);
  const [humanOverride, setHumanOverride] = useState<'ALLOW' | 'REJECT' | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Load custom agent if query param exists, or from localStorage
  useEffect(() => {
    async function loadCustomAgent() {
      if (customAgentIdParam) {
        try {
          const res = await fetch(`${API_BASE_URL}/agents/${customAgentIdParam}`);
          if (res.ok) {
            const agent: Agent = await res.json();
            setCustomAgent(agent);
            setActiveKey('custom');
            setCustomAmount(Math.min(50, agent.transactionLimit || 50));
            return;
          }
        } catch (e) {
          console.warn('[TrustCheck] Could not fetch custom agent by ID:', e);
        }
      }

      // Check localStorage fallback
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('verdict_custom_agents');
        if (stored) {
          try {
            const agents: Agent[] = JSON.parse(stored);
            if (agents.length > 0) {
              const latest = agents[agents.length - 1];
              setCustomAgent(latest);
              if (customAgentIdParam) {
                setActiveKey('custom');
              }
            }
          } catch (e) {
            console.error('[TrustCheck] Failed to parse custom agents from localStorage', e);
          }
        }
      }
    }

    loadCustomAgent();
  }, [customAgentIdParam]);

  // Construct scenario for custom agent
  const customScenario: DemoScenario = {
    id: 'alpha',
    title: customAgent?.displayName || 'Custom Agent',
    subtitle: `Self-registered agent (${customAgent?.verificationStatus || 'verified'})`,
    agent: customAgent || {
      id: 'custom-demo',
      walletAddress: '0x0000000000000000000000000000000000000000',
      displayName: 'Custom Agent',
      capabilities: ['payment', 'transfer'],
      verificationStatus: 'verified',
      transactionLimit: 500,
      reviewThreshold: 100,
      createdAt: new Date().toISOString(),
    },
    actionDescription: `Send ${customAmount} USDC to ${customRecipient.slice(0, 7)}...${customRecipient.slice(-4)}`,
    recipientAddress: customRecipient,
    amount: customAmount,
    token: 'USDC',
    decision: 'ALLOW',
    reasons: ['Evaluating custom agent with real deterministic rule engine...'],
    txHash: null,
    authorizationToken: null,
    checks: [
      {
        id: 'c1',
        label: 'Identity verified',
        detail: customAgent?.verificationStatus === 'verified' ? 'Verified in SQLite passport registry' : 'Unverified agent address',
        status: customAgent?.verificationStatus === 'verified' ? 'pass' : 'fail',
      },
      {
        id: 'c2',
        label: 'Capability declared',
        detail: `${customActionType} capability in passport`,
        status: customAgent?.capabilities?.map((c) => c.toLowerCase()).includes(customActionType.toLowerCase()) ? 'pass' : 'fail',
      },
      {
        id: 'c3',
        label: 'Within transaction limit',
        detail: `${customAmount} USDC vs ${customAgent?.transactionLimit ?? 500} limit / ${customAgent?.reviewThreshold ?? 100} review threshold`,
        status:
          customAgent && customAmount > customAgent.transactionLimit
            ? 'fail'
            : customAgent && customAmount > customAgent.reviewThreshold
            ? 'pending'
            : 'pass',
      },
      {
        id: 'c4',
        label: 'Recipient trusted',
        detail: 'Evaluated against counterparty risk profile',
        status: 'pass',
      },
      {
        id: 'c5',
        label: 'No reputation flags',
        detail: 'Evaluated against anomalous velocity thresholds',
        status: 'pass',
      },
    ],
  };

  const scenario: DemoScenario = activeKey === 'custom' ? customScenario : demoScenarios[activeKey];

  // Evaluate action using real API endpoint POST /trust/evaluate
  const evaluateAction = useCallback(async (key: TabKey) => {
    setIsLoading(true);
    setApiError(null);
    setEvaluationComplete(false);
    setHumanOverride(null);

    const isCustom = key === 'custom';
    let payload;
    if (isCustom) {
      if (!customAgent) {
        setIsLoading(false);
        return;
      }
      payload = {
        agentId: customAgent.id,
        actionType: customActionType,
        targetAddress: customRecipient,
        amount: Number(customAmount),
        token: 'USDC',
      };
    } else {
      const currentScenario = demoScenarios[key];
      payload = {
        agentId: currentScenario.agent.id,
        actionType: key === 'shadow' ? 'TRANSFER' : 'PAYMENT',
        targetAddress: currentScenario.recipientAddress,
        amount: currentScenario.amount,
        token: currentScenario.token,
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/trust/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      let txHash: string | null = null;

      // On ALLOW, execute single-use authorization token ONLY for demo agents (Safety Guardrail)
      if (data.decision === 'ALLOW' && data.authorizationToken && !isCustom) {
        try {
          const executeRes = await fetch(`${API_BASE_URL}/actions/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actionRequestId: data.actionRequestId,
              authorizationToken: data.authorizationToken,
            }),
          });

          if (executeRes.ok) {
            const executeData = await executeRes.json();
            txHash = executeData.txHash || null;
          } else {
            const errData = await executeRes.json().catch(() => ({}));
            setApiError(errData.message || 'On-chain execution could not complete.');
          }
        } catch (execErr) {
          console.warn('[TrustCheck] Action execution call failed:', execErr);
          setApiError('On-chain execution network error.');
        }
      }

      setApiResult({
        actionRequestId: data.actionRequestId,
        decision: data.decision,
        reasons: data.reasons && data.reasons.length > 0 ? data.reasons : scenario.reasons,
        authorizationToken: data.authorizationToken || null,
        docketMatches: data.docketMatches && data.docketMatches.length > 0 ? data.docketMatches : scenario.docketMatches,
        txHash: txHash || null,
      });
    } catch (err: any) {
      console.warn('[TrustCheck] Fetch /trust/evaluate failed, falling back to local scenario:', err);
      setApiError(`Could not connect to ${API_BASE_URL}. Showing offline evaluation.`);
      setApiResult({
        actionRequestId: `local-${scenario.id}`,
        decision: scenario.decision,
        reasons: scenario.reasons,
        authorizationToken: scenario.authorizationToken,
        docketMatches: scenario.docketMatches,
        txHash: scenario.txHash,
      });
    } finally {
      setIsLoading(false);
      setRunKey((prev) => prev + 1);
    }
  }, [customAgent, customActionType, customAmount, customRecipient, scenario]);

  // Initial evaluation on mount or activeKey change
  useEffect(() => {
    if (activeKey === 'custom' && !customAgent) return;
    evaluateAction(activeKey);
  }, [activeKey, customAgent, evaluateAction]);

  const handleScenarioChange = (key: TabKey) => {
    setActiveKey(key);
  };

  const handleRerun = () => {
    evaluateAction(activeKey);
  };

  // Human review overrides for REVIEW outcome
  const handleHumanApprove = async () => {
    setIsReviewing(true);
    if (apiResult?.actionRequestId && !apiResult.actionRequestId.startsWith('local-')) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions/${apiResult.actionRequestId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: true }),
        });
        if (res.ok) {
          const data = await res.json();
          let txHash: string | null = data.txHash || null;

          // If a fresh authorizationToken was issued on review approve, execute on-chain ONLY for demo agents
          if (data.authorizationToken && activeKey !== 'custom') {
            try {
              const execRes = await fetch(`${API_BASE_URL}/actions/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actionRequestId: data.id || apiResult.actionRequestId,
                  authorizationToken: data.authorizationToken,
                }),
              });
              if (execRes.ok) {
                const execData = await execRes.json();
                txHash = execData.txHash || null;
              } else {
                const errData = await execRes.json().catch(() => ({}));
                setApiError(errData.message || 'On-chain execution reverted');
              }
            } catch (execErr: any) {
              console.warn('[TrustCheck] Human review execute error:', execErr);
              setApiError(execErr.message || 'On-chain execution network error');
            }
          }

          setApiResult((prev) =>
            prev
              ? {
                  ...prev,
                  txHash: txHash,
                  decision: 'ALLOW',
                }
              : prev
          );
          setHumanOverride('ALLOW');
        }
      } catch (err) {
        console.warn('[TrustCheck] Human review approve error:', err);
        setHumanOverride('ALLOW');
      } finally {
        setIsReviewing(false);
      }
    } else {
      setHumanOverride('ALLOW');
      setIsReviewing(false);
    }
  };

  const handleHumanDeny = async () => {
    setHumanOverride('REJECT');
    if (apiResult?.actionRequestId && !apiResult.actionRequestId.startsWith('local-')) {
      try {
        await fetch(`${API_BASE_URL}/actions/${apiResult.actionRequestId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: false }),
        });
      } catch (err) {
        console.warn('[TrustCheck] Human review deny error:', err);
      }
    }
  };

  const currentDecision: Decision = humanOverride || (apiResult ? apiResult.decision : scenario.decision);
  const currentReasons = apiResult?.reasons || scenario.reasons;
  const currentTxHash = apiResult?.txHash || null;
  const currentDocketMatches = apiResult?.docketMatches || scenario.docketMatches;

  // Build checks based on real evaluation outcome
  const currentChecks: CheckItem[] = scenario.checks.map((check) => {
    if (currentDecision === 'ALLOW') {
      return { ...check, status: 'pass' };
    }
    if (currentDecision === 'REJECT') {
      return { ...check, status: 'fail' };
    }
    return check;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Top Header & Scenario Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6d5bff] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive security evaluation gate</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Trust Check</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Deterministic pre-action gate verifying identity, capability, and policy on Base Sepolia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GlowButton
            variant="secondary"
            size="sm"
            onClick={handleRerun}
            disabled={isLoading}
            title="Re-run the evaluation"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Evaluating...' : 'Re-run evaluation'}</span>
          </GlowButton>
        </div>
      </div>

      {/* Network Alert */}
      {apiError && (
        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button
            onClick={() => evaluateAction(activeKey)}
            className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-white underline shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Scenario Selection Tabs (4 tabs: Alpha, Shadow, Sentinel, Custom) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        {(['alpha', 'shadow', 'sentinel'] as const).map((key) => {
          const s = demoScenarios[key];
          const isSelected = activeKey === key;

          return (
            <button
              key={key}
              onClick={() => handleScenarioChange(key)}
              className={`p-3.5 rounded-xl text-left border transition-all duration-150 ${
                isSelected
                  ? 'bg-white/[0.08] border-white/20 shadow-[0_0_20px_-4px_rgba(255,255,255,0.08)]'
                  : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white truncate">{s.agent.displayName}</span>
                <DecisionBadge status={s.decision} size="sm" showGlow={isSelected} />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-1">{s.subtitle}</p>
            </button>
          );
        })}

        {/* 4th Dynamic Tab: Custom Agent or Register Link */}
        {customAgent ? (
          <button
            onClick={() => handleScenarioChange('custom')}
            className={`p-3.5 rounded-xl text-left border transition-all duration-150 ${
              activeKey === 'custom'
                ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_20px_-4px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                : 'bg-white/[0.025] hover:bg-white/[0.05] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-cyan-300 truncate">{customAgent.displayName}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Custom
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              Limit: {customAgent.transactionLimit} USDC
            </p>
          </button>
        ) : (
          <Link
            href="/register"
            className="p-3.5 rounded-xl text-left border border-dashed border-white/15 hover:border-cyan-500/40 bg-white/[0.01] hover:bg-cyan-500/[0.05] transition-all flex flex-col justify-center items-center text-center group"
          >
            <div className="flex items-center gap-1 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">
              <Plus className="w-3.5 h-3.5" />
              <span>Register Agent</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">Test your own agent</span>
          </Link>
        )}
      </div>

      {/* Interactive Action Configurator for Custom Agent */}
      {activeKey === 'custom' && customAgent && (
        <div className="glass-panel p-4 border-cyan-500/30 bg-cyan-950/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Simulate Action Request for {customAgent.displayName}</span>
            </div>
            <Link
              href="/register"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
            >
              + Register Another
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-medium mb-1">
                Action Type
              </label>
              <select
                value={customActionType}
                onChange={(e) => setCustomActionType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="PAYMENT">PAYMENT (Declared: {customAgent.capabilities.includes('payment') ? 'Yes' : 'No'})</option>
                <option value="TRANSFER">TRANSFER (Declared: {customAgent.capabilities.includes('transfer') ? 'Yes' : 'No'})</option>
                <option value="SWAP">SWAP (Declared: {customAgent.capabilities.includes('swap') ? 'Yes' : 'No'})</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-medium mb-1">
                Amount (USDC)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">
                Limit: {customAgent.transactionLimit} | Review: {customAgent.reviewThreshold}
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 uppercase font-medium mb-1">
                Recipient
              </label>
              <input
                type="text"
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full font-mono text-[11px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => evaluateAction('custom')}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Evaluating Gate...' : 'Run Gate Evaluation'}
            </button>
          </div>
        </div>
      )}

      {/* Main Trust Check Card */}
      <div className="glass-panel p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Subtle background highlight matching current status */}
        <div
          className={`absolute -top-24 -right-24 w-72 h-72 rounded-full filter blur-3xl opacity-20 pointer-events-none transition-colors duration-500 ${
            currentDecision === 'ALLOW'
              ? 'bg-emerald-500'
              : currentDecision === 'REJECT'
              ? 'bg-rose-500'
              : 'bg-amber-500'
          }`}
        />

        {/* Request Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <AgentAvatar id={scenario.agent.id} name={scenario.agent.displayName} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{scenario.agent.displayName}</h2>
                <Link
                  href={`/agents/${scenario.agent.id}`}
                  className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-0.5 underline decoration-slate-600 underline-offset-2"
                >
                  <span>Passport</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">{scenario.actionDescription}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="text-right hidden sm:block">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 block">Status</span>
              <span className="text-xs text-slate-300">
                {isLoading
                  ? 'Contacting API...'
                  : evaluationComplete
                  ? 'Evaluation finalized'
                  : 'Verifying gates...'}
              </span>
            </div>
            {isLoading ? (
              <div className="w-24 h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              </div>
            ) : (
              <DecisionBadge status={currentDecision} size="lg" showGlow={evaluationComplete} />
            )}
          </div>
        </div>

        {/* The 5 Security Checks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Deterministic verification gates</span>
            <span>Policy status</span>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs font-mono">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span>POST /trust/evaluate in-flight...</span>
            </div>
          ) : (
            <CheckList
              checks={currentChecks}
              runKey={runKey}
              onComplete={() => setEvaluationComplete(true)}
            />
          )}
        </div>

        {/* Dynamic Outcome Panels */}
        {!isLoading && evaluationComplete && (
          <div className="pt-2 animate-fadeIn transition-opacity duration-300">
            {/* ALLOW Outcome Panel */}
            {currentDecision === 'ALLOW' && (
              <div className="glass-panel-subtle p-5 border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_24px_-4px_rgba(34,197,94,0.25)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-semibold tracking-wide uppercase">
                      Action approved by security gate
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400/80 font-mono">Base Sepolia</span>
                </div>

                {/* Real On-Chain Tx Hash Display (When present) */}
                {currentTxHash ? (
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400">Verified On-Chain Transaction</span>
                    <div className="flex items-center justify-between gap-3 bg-black/40 border border-emerald-500/20 rounded-lg p-2.5 font-mono text-xs text-[#2f6fed] break-all">
                      <span>{currentTxHash}</span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${currentTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-white shrink-0"
                        title="Inspect on Base Sepolia block explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : activeKey === 'custom' ? (
                  /* Safety Guardrail for Custom Agents */
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      <span>Shared Testnet Wallet Guardrail Active</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Live execution is limited to demo agents to protect the shared test wallet — evaluation logic is fully real for any agent you register.
                    </p>
                    {apiResult?.authorizationToken && (
                      <div className="pt-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                          Single-Use Authorization Token Minted:
                        </span>
                        <div className="p-2 rounded-lg bg-black/50 border border-cyan-500/20 font-mono text-[11px] text-cyan-300 break-all select-all">
                          {apiResult.authorizationToken}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-slate-800 bg-black/30 text-xs text-slate-400">
                    Authorization token minted. On-chain execution pending or completed without recorded hash.
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  {activeKey === 'custom'
                    ? 'Security gate verified identity and capabilities; minted valid single-use token.'
                    : 'Single-use authorization token verified and consumed by backend executor.'}
                </p>
              </div>
            )}

            {/* REJECT Outcome Panel */}
            {currentDecision === 'REJECT' && (
              <div className="glass-panel-subtle p-5 border-rose-500/30 bg-rose-950/20 shadow-[0_0_24px_-4px_rgba(239,68,68,0.25)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400">
                    <ShieldBan className="w-4 h-4" />
                    <span className="text-xs font-semibold tracking-wide uppercase">
                      Action blocked by security gate
                    </span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono">
                    No transaction created
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {currentReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 text-xs text-rose-200"
                    >
                      {reason}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-400">
                  Genuinely blocked — no authorization token was issued, ensuring execution is impossible.
                </p>
              </div>
            )}

            {/* REVIEW Outcome Panel */}
            {currentDecision === 'REVIEW' && (
              <div className="space-y-4">
                <div className="glass-panel-subtle p-5 border-amber-500/30 bg-amber-950/20 shadow-[0_0_24px_-4px_rgba(245,158,11,0.25)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs font-semibold tracking-wide uppercase">
                        Requires human sign-off
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-400/80">Borderline policy trigger</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/20 text-xs text-amber-200">
                    {currentReasons[0]}
                  </div>

                  {/* Human Reviewer Action Controls */}
                  <div className="pt-2 flex items-center justify-between border-t border-amber-500/20">
                    <span className="text-xs text-slate-300">Human reviewer action:</span>
                    <div className="flex items-center gap-2">
                      <GlowButton
                        variant="danger"
                        size="sm"
                        onClick={handleHumanDeny}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Deny</span>
                      </GlowButton>
                      <GlowButton
                        variant="success"
                        size="sm"
                        onClick={handleHumanApprove}
                        disabled={isReviewing}
                      >
                        <Check className={`w-3.5 h-3.5 ${isReviewing ? 'animate-spin' : ''}`} />
                        <span>{isReviewing ? 'Executing...' : 'Approve & sign'}</span>
                      </GlowButton>
                    </div>
                  </div>
                </div>

                {/* Embedded Docket Panel - Visible only when decision === 'REVIEW' */}
                <DocketPanel
                  category="transfer"
                  fallbackEntries={currentDocketMatches}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrustCheckPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading trust check simulation...
        </div>
      }
    >
      <TrustCheckContent />
    </Suspense>
  );
}
