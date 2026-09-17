'use client';

import React from 'react';
import Link from 'next/link';
import { VerdictLogo } from './VerdictLogo';

export function TopNav() {
  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Trust Check', href: '/trust-check' },
    { label: 'Agent Passports', href: '/agents' },
    { label: 'Audit Log', href: '/audit-log' },
  ];

  return (
    <header className="w-full z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 h-16 flex items-center justify-between">
        {/* Brand (Left) */}
        <Link href="/" className="flex items-center gap-3 group select-none">
          <VerdictLogo className="w-7 h-7 text-white shrink-0 transition-transform duration-200 group-hover:scale-105" />
          <span className="text-base font-bold tracking-tight text-white group-hover:text-slate-200 transition-colors">
            Verdict
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13px] text-slate-300 hover:text-white font-normal tracking-normal transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Action: Try Demo Button */}
        <div className="flex items-center">
          <Link
            href="/trust-check?scenario=alpha"
            className="rounded-full border border-white/20 hover:border-white/40 text-white text-[13px] font-medium px-5 py-2 transition-all bg-white/[0.04] hover:bg-white/[0.1] backdrop-blur-sm shadow-sm"
          >
            Try Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
