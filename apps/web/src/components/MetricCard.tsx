import React from 'react';

export type MetricTone = 'blue' | 'green' | 'red' | 'amber';

interface MetricCardProps {
  label: string;
  value: string | number;
  tone: MetricTone;
  icon: React.ReactNode;
  subtext?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  tone,
  icon,
  subtext,
  className = '',
}: MetricCardProps) {
  const toneConfigs = {
    blue: {
      border: 'border-blue-500/20 hover:border-blue-500/40',
      iconBg: 'bg-blue-500/10 text-blue-400',
      glow: 'hover:shadow-[0_0_20px_-4px_rgba(47,111,237,0.25)]',
    },
    green: {
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      glow: 'hover:shadow-[0_0_20px_-4px_rgba(34,197,94,0.25)]',
    },
    red: {
      border: 'border-rose-500/20 hover:border-rose-500/40',
      iconBg: 'bg-rose-500/10 text-rose-400',
      glow: 'hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.25)]',
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10 text-amber-400',
      glow: 'hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.25)]',
    },
  };

  const config = toneConfigs[tone];

  return (
    <div
      className={`glass-panel p-5 transition-all duration-200 ${config.border} ${config.glow} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-slate-400 font-normal">{label}</span>
        <div className={`p-2 rounded-lg ${config.iconBg}`}>{icon}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold text-slate-100 tracking-tight leading-none">
          {value}
        </span>
        {subtext && <span className="text-xs text-slate-500">{subtext}</span>}
      </div>
    </div>
  );
}
