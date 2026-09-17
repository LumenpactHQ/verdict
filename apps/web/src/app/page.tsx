'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  ArrowLeftRight,
  Clock,
  Shield,
  FileSearch,
  ChevronRight,
} from 'lucide-react';
import { VerdictLogo } from '../components/VerdictLogo';

export default function LandingPage() {
  const chips = [
    { label: 'Payment', icon: CreditCard, color: 'text-cyan-400', shadow: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]' },
    { label: 'Transfer', icon: ArrowLeftRight, color: 'text-cyan-400', shadow: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]' },
    { label: 'Review', icon: Clock, color: 'text-amber-400', shadow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]' },
    { label: 'Reject', icon: Shield, color: 'text-rose-400', shadow: 'shadow-[0_0_12px_rgba(244,63,94,0.15)]' },
    { label: 'Audit', icon: FileSearch, color: 'text-emerald-400', shadow: 'shadow-[0_0_12px_rgba(52,211,153,0.15)]' },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-start px-4 sm:px-6 pt-5 sm:pt-7 pb-16 max-w-6xl mx-auto w-full z-10 text-center">
        {/* Main Heading with Metallic Silver Chrome Gradient */}
        <h1
          className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-extrabold tracking-tight leading-[1.1] select-none text-center"
          style={{
            background:
              'linear-gradient(180deg, #A4B2C6 0%, #FFFFFF 38%, #D7DEE8 68%, #6B7B94 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}
        >
          <span className="block">Verify the agent.</span>
          <span className="block mt-1">Render the verdict.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-sm sm:text-base md:text-[17px] leading-relaxed max-w-xl mx-auto mt-6 sm:mt-7 font-normal">
          A pre-action security gate for autonomous agents on Base —
          <br className="hidden sm:inline" /> deterministic rules decide, every time.
        </p>

        {/* Action Button */}
        <div className="flex items-center justify-center mt-8 sm:mt-9">
          <Link
            href="/trust-check?scenario=alpha"
            className="bg-[#1d65e5] hover:bg-[#1855c4] text-white text-sm font-medium px-7 py-2.5 rounded-full transition-colors flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(29,101,229,0.35)]"
          >
            <span>Run Agent Alpha</span>
            <ArrowRight className="w-4 h-4 stroke-[2.2]" />
          </Link>
        </div>

        {/* Pipeline Steps Tracker — Tightened Spacing */}
        <div className="w-full max-w-xl mx-auto mt-8 mb-6 relative">
          {/* Glowing connecting line */}
          <div className="absolute top-[22px] left-10 right-10 h-[1.5px] -translate-y-1/2 pointer-events-none">
            <div className="w-full h-full bg-gradient-to-r from-blue-500/20 via-blue-500/50 to-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.7)]" />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            {chips.map((chip) => {
              const Icon = chip.icon;
              return (
                <div key={chip.label} className="flex flex-col items-center group cursor-pointer">
                  <div className={`w-11 h-11 rounded-xl bg-[#0b101c] border border-blue-500/30 flex items-center justify-center ${chip.color} ${chip.shadow} transition-transform group-hover:scale-105`}>
                    <Icon className="w-5 h-5 stroke-[1.8]" />
                  </div>
                  <span className="text-xs text-slate-400 mt-2 font-normal group-hover:text-slate-200 transition-colors">
                    {chip.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Card Preview — Moved Closer Up */}
        <div className="w-full max-w-[760px] mx-auto bg-[#0b101d]/90 border border-blue-500/20 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-md text-left mt-1">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            {/* Agent Info */}
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#2a1f0a] border border-amber-600/30 flex items-center justify-center text-amber-500 font-bold text-sm select-none shrink-0">
                AA
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-[15px]">Agent Alpha</span>
                  <span className="bg-[#052b1e] border border-emerald-500/30 text-[#22c55e] text-[10px] font-bold tracking-wider px-2 py-0.5 rounded">
                    VERIFIED
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-xs mt-0.5">
                  Send 5 USDC to 0x8f2...c91
                </div>
              </div>
            </div>

            {/* Result Tag */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs font-medium">Result</span>
              <div className="bg-[#052b1e] border border-emerald-500/40 text-[#22c55e] px-3.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                Allow
              </div>
            </div>
          </div>

          {/* Row 1: Identity verified */}
          <div className="bg-[#050914]/80 border border-emerald-950/40 rounded-xl px-5 py-3 flex items-center justify-between mt-4">
            <span className="text-slate-200 text-xs sm:text-sm font-medium">Identity verified</span>
            <span className="text-[#34d399] font-mono text-xs sm:text-sm">Base Sepolia registry</span>
          </div>

          {/* Row 2: Within transaction limit */}
          <div className="bg-[#050914]/80 border border-emerald-950/40 rounded-xl px-5 py-3 flex items-center justify-between mt-2.5">
            <span className="text-slate-200 text-xs sm:text-sm font-medium">
              Within transaction limit
            </span>
            <span className="text-[#34d399] font-mono text-xs sm:text-sm">5 of 50 USDC</span>
          </div>

          {/* Row 3: Hash and Interactive test */}
          <div className="bg-[#050914]/90 border border-emerald-950/40 rounded-xl px-5 py-3 mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1 mr-2">
              <div className="text-[10px] font-mono text-slate-400 font-semibold tracking-wider uppercase mb-0.5">
                BASE SEPOLIA EXECUTION HASH
              </div>
              <div className="text-[#38bdf8] font-mono text-xs sm:text-[13px] tracking-tight truncate select-all">
                0x7a3f81c902b4d7e9b048593a19e5c46b9a8e2d7c5b3a10e4f8d6c7b9a0e1f234
              </div>
            </div>

            <Link
              href="/trust-check?scenario=alpha"
              className="flex items-center gap-1 text-white hover:text-blue-400 text-xs sm:text-sm font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 group"
            >
              <span>Inspect execution</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Honest Hackathon Footer */}
      <footer className="w-full border-t border-white/10 bg-[#030611]/90 backdrop-blur-md mt-auto z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-6 sm:px-12 py-7">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 text-slate-400">
            <VerdictLogo className="w-5 h-5 text-white shrink-0" />
            <span className="text-slate-300 font-medium">Built for the Orion Builder Hackathon</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a
              href="https://github.com/LumenpactHQ/verdict"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              GitHub repo
            </a>
            <a
              href="https://sepolia.basescan.org/address/0x3B2c4F789a6F9a19491bC8Fe098eE0B647184C10"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
            >
              View contract on BaseScan
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
