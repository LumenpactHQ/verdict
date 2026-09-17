import React from 'react';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function GlowButton({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: GlowButtonProps) {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs font-semibold rounded-lg',
    md: 'px-5 py-2.5 text-sm font-semibold rounded-xl',
    lg: 'px-7 py-3 text-base font-semibold rounded-xl',
  };

  const variantClasses = {
    primary:
      'bg-[#2f6fed] text-white hover:bg-[#285ec9] shadow-[0_0_24px_-4px_rgba(47,111,237,0.45)] border border-[#3d7ef7]/60 active:brightness-95',
    secondary:
      'bg-white/[0.06] hover:bg-white/[0.1] text-slate-100 border border-white/10 active:brightness-95 backdrop-blur-md',
    ghost:
      'bg-transparent hover:bg-white/[0.05] text-slate-300 hover:text-white border border-transparent',
    danger:
      'bg-rose-600/90 text-white hover:bg-rose-500 shadow-[0_0_24px_-4px_rgba(239,68,68,0.4)] border border-rose-400/40',
    success:
      'bg-emerald-600/90 text-white hover:bg-emerald-500 shadow-[0_0_24px_-4px_rgba(34,197,94,0.4)] border border-emerald-400/40',
  };

  const disabledClasses = disabled
    ? 'opacity-40 cursor-not-allowed pointer-events-none shadow-none'
    : 'cursor-pointer transition-all duration-150';

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 tracking-tight ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
