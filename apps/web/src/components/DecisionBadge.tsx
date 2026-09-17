import React from 'react';
import type { Decision } from '@verdict/shared';

export type DecisionStatus = Decision | 'allow' | 'review' | 'reject';

interface DecisionBadgeProps {
  status: DecisionStatus;
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
  className?: string;
}

export function DecisionBadge({
  status,
  size = 'md',
  showGlow = true,
  className = '',
}: DecisionBadgeProps) {
  const normalized = status.toUpperCase() as Decision;

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-0.5 tracking-wide',
    md: 'text-sm px-3.5 py-1 tracking-wide',
    lg: 'text-base px-5 py-1.5 font-semibold tracking-wider',
  };

  const styleConfig = {
    ALLOW: {
      label: 'Allow',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/40',
      text: 'text-emerald-400',
      glow: showGlow ? 'shadow-[0_0_24px_-4px_rgba(34,197,94,0.45)]' : '',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]',
    },
    REVIEW: {
      label: 'Review',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/40',
      text: 'text-amber-400',
      glow: showGlow ? 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.45)]' : '',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    },
    REJECT: {
      label: 'Reject',
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/40',
      text: 'text-rose-400',
      glow: showGlow ? 'shadow-[0_0_24px_-4px_rgba(239,68,68,0.45)]' : '',
      dot: 'bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    },
  }[normalized] || {
    label: 'Unknown',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/40',
    text: 'text-slate-400',
    glow: '',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold select-none backdrop-blur-md transition-all duration-200 ${sizeClasses[size]} ${styleConfig.bg} ${styleConfig.border} ${styleConfig.text} ${styleConfig.glow} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styleConfig.dot}`} />
      <span>{styleConfig.label}</span>
    </span>
  );
}
