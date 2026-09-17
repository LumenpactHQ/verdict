import React from 'react';

interface AgentAvatarProps {
  id: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AgentAvatar({
  id,
  name,
  size = 'md',
  className = '',
}: AgentAvatarProps) {
  // Generate deterministic hue from string
  const getDeterministicHue = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hues = [
      { bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
      { bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
      { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
      { bg: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
      { bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
      { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    ];
    const index = Math.abs(hash) % hues.length;
    return hues[index];
  };

  const getInitials = (str: string) => {
    const parts = str.trim().split(/[\s-_]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs border',
    md: 'w-10 h-10 text-sm border',
    lg: 'w-14 h-14 text-base border-2',
    xl: 'w-20 h-20 text-xl border-2 font-semibold',
  };

  const colorConfig = getDeterministicHue(id || name);
  const initials = getInitials(name || id);

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0 ${sizeClasses[size]} ${colorConfig.bg} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
