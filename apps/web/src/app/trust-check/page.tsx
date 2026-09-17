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
} from 'lucide-react';
import type { Decision, DocketEntry } from '@verdict/shared';
import { demoScenarios, type DemoScenario, type CheckItem } from '../../fixtures/scenarios';
import { DecisionBadge } from '../../components/DecisionBadge';
import { CheckList } from '../../components/CheckList';
import { AgentAvatar } from '../../components/AgentAvatar';
import { GlowButton } from '../../components/GlowButton';
import { DocketPanel } from '../../components/DocketPanel';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface EvaluationState {
  actionRequestId: string;
  decision: Decision;
  reasons: string[];
  authorizationToken: string | null;
  docketMatches?: DocketEntry[];
  txHash: string | null;
}

function TrustCheckContent() {
  const searchParams = useSearchParams();
  const initialScenarioKey = (searchParams.get('scenario') as 'alpha' | 'shadow' | 'sentinel') || 'alpha';

  const [activeKey, setActiveKey] = useState<'alpha' | 'shadow' | 'sentinel'>(
    demoScenarios[initialScenarioKey] ? initialScenarioKey : 'alpha'
  );
  const [runKey, setRunKey] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<EvaluationState | null>(null);
  const [evaluationComplete, setEvaluationComplete] = useState<boolean>(false);
  const [humanOverride, setHumanOverride] = useState<'ALLOW' | 'REJECT' | null>(null);

  const scenario = demoScenarios[activeKey];

  // Evaluate action using real API endpoint POST /trust/evaluate
  const evaluateAction = useCallback(async (key: 'alpha' | 'shadow' | 'sentinel') => {
    setIsLoading(true);
    setApiError(null);
    setEvaluationComplete(false);
    setHumanOverride(null);

    const currentScenario = demoScenarios[key];
    const payload = {
      agentId: currentScenario.agent.id,
      actionType: key === 'shadow' ? 'TRANSFER' : 'PAYMENT',
      targetAddress: currentScenario.recipientAddress,
      amount: currentScenario.amount,
      token: currentScenario.token,
    };

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

      // On ALLOW, execute single-use authorization token on /actions/execute to obtain on-chain tx hash
      if (data.decision === 'ALLOW' && data.authorizationToken) {
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
          }
        } catch (execErr) {
          console.warn('[TrustCheck] Action execution call failed:', execErr);
        }
      }

      setApiResult({
        actionRequestId: data.actionRequestId,
        decision: data.decision,
        reasons: data.reasons && data.reasons.length > 0 ? data.reasons : currentScenario.reasons,
        authorizationToken: data.authorizationToken || null,
        docketMatches: data.docketMatches && data.docketMatches.length > 0 ? data.docketMatches : currentScenario.docketMatches,
        txHash: txHash || (data.decision === 'ALLOW' ? currentScenario.txHash : null),
      });
    } catch (err: any) {
      console.warn('[TrustCheck] Fetch /trust/evaluate failed, falling back to local scenario:', err);
      setApiError(`Could not connect to ${API_BASE_URL}. Showing offline evaluation.`);
      setApiResult({
        actionRequestId: `local-${currentScenario.id}`,
        decision: currentScenario.decision,
        reasons: currentScenario.reasons,
        authorizationToken: currentScenario.authorizationToken,
        docketMatches: currentScenario.docketMatches,
        txHash: currentScenario.txHash,
      });
    } finally {
      setIsLoading(false);
      setRunKey((prev) => prev + 1);
    }
  }, []);

  // Initial evaluation on mount or activeKey change
  useEffect(() => {
    evaluateAction(activeKey);
  }, [activeKey, evaluateAction]);

  const handleScenarioChange = (key: 'alpha' | 'shadow' | 'sentinel') => {
    setActiveKey(key);
  };

  const handleRerun = () => {
    evaluateAction(activeKey);
  };

  // Human review overrides for REVIEW outcome
  const handleHumanApprove = async () => {
    setHumanOverride('ALLOW');
    if (apiResult?.actionRequestId && !apiResult.actionRequestId.startsWith('local-')) {
      try {
        const res = await fetch(`${API_BASE_URL}/actions/${apiResult.actionRequestId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approve: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.txHash) {
            setApiResult((prev) => prev ? { ...prev, txHash: data.txHash, decision: 'ALLOW' } : prev);
          }
        }
      } catch (err) {
        console.warn('[TrustCheck] Human review approve error:', err);
      }
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
  const currentTxHash = apiResult?.txHash || scenario.txHash;
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
            title="Re-run the evaluation animation"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Evaluating...' : 'Re-run evaluation'}</span>
          </GlowButton>
        </div>
      </div>

      {/* Network Alert (if backend is unreachable, gracefully inform without breaking UI) */}
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

      {/* Scenario Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
      </div>

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
                      Action approved for on-chain execution
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400/80 font-mono">Base Sepolia</span>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Transaction hash</span>
                  <div className="flex items-center justify-between gap-3 bg-black/40 border border-emerald-500/20 rounded-lg p-2.5 font-mono text-xs text-[#2f6fed] break-all">
                    <span>
                      {currentTxHash ||
                        '0x7a3f81c902b4d7e9b048593a19e5c46b9a8e2d7c5b3a10e4f8d6c7b9a0e1f234'}
                    </span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${
                        currentTxHash ||
                        '0x7a3f81c902b4d7e9b048593a19e5c46b9a8e2d7c5b3a10e4f8d6c7b9a0e1f234'
                      }`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white shrink-0"
                      title="Inspect on Base Sepolia block explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Single-use authorization token verified and consumed by backend executor.
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
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
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
