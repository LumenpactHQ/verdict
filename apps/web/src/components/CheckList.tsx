'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { CheckItem } from '../fixtures/scenarios';

interface CheckListProps {
  checks: CheckItem[];
  runKey?: number | string;
  onComplete?: () => void;
  className?: string;
}

export function CheckList({
  checks,
  runKey = 0,
  onComplete,
  className = '',
}: CheckListProps) {
  // resolvedCount indicates how many items have resolved
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  // currentlyPulsing index
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setResolvedCount(checks.length);
      setPulsingIndex(null);
      if (onComplete) onComplete();
      return;
    }

    // Reset resolution
    setResolvedCount(0);
    setPulsingIndex(null);

    const stepInterval = 480; // ~480ms per check
    const timers: NodeJS.Timeout[] = [];

    checks.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setResolvedCount((prev) => Math.max(prev, idx + 1));
        setPulsingIndex(idx);

        // Clear pulse after 400ms
        const pulseTimer = setTimeout(() => {
          setPulsingIndex((current) => (current === idx ? null : current));
        }, 400);
        timers.push(pulseTimer);

        // When the last item resolves, invoke onComplete
        if (idx === checks.length - 1 && onComplete) {
          const completeTimer = setTimeout(onComplete, 200);
          timers.push(completeTimer);
        }
      }, (idx + 1) * stepInterval);

      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [checks, runKey, onComplete]);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {checks.map((check, index) => {
        const isResolved = index < resolvedCount;
        const isPulsing = pulsingIndex === index;

        // Styling based on state and status
        let icon = <Clock className="w-4 h-4 text-slate-500 animate-spin" />;
        let borderColor = 'border-slate-800/60 bg-slate-900/20';
        let glowClass = '';
        let labelColor = 'text-slate-400';

        if (isResolved) {
          if (check.status === 'pass') {
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
            borderColor = 'border-emerald-900/40 bg-emerald-950/15';
            glowClass = isPulsing
              ? 'shadow-[0_0_24px_-4px_rgba(34,197,94,0.6)] border-emerald-500/60'
              : 'shadow-[0_0_12px_-4px_rgba(34,197,94,0.2)]';
            labelColor = 'text-slate-100';
          } else if (check.status === 'fail') {
            icon = <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
            borderColor = 'border-rose-900/40 bg-rose-950/20';
            glowClass = isPulsing
              ? 'shadow-[0_0_24px_-4px_rgba(239,68,68,0.6)] border-rose-500/60'
              : 'shadow-[0_0_12px_-4px_rgba(239,68,68,0.2)]';
            labelColor = 'text-slate-100';
          } else {
            icon = <Clock className="w-4 h-4 text-amber-400 shrink-0" />;
            borderColor = 'border-amber-900/40 bg-amber-950/15';
            glowClass = isPulsing
              ? 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.6)] border-amber-500/60'
              : 'shadow-[0_0_12px_-4px_rgba(245,158,11,0.2)]';
            labelColor = 'text-slate-100';
          }
        }

        return (
          <div
            key={check.id}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 ${borderColor} ${glowClass} ${
              isResolved ? 'opacity-100 translate-y-0' : 'opacity-35 translate-y-1'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {icon}
              <span className={`text-sm font-semibold tracking-tight truncate ${labelColor}`}>
                {check.label}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 text-right ml-4 shrink-0">
              {isResolved ? check.detail : 'Evaluating...'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
