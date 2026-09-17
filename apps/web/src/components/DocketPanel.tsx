'use client';

import React, { useState, useEffect } from 'react';
import type { DocketEntry } from '@verdict/shared';
import { ShieldCheck, ShieldAlert, History, Loader2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface DocketEntryCardProps {
  entry: DocketEntry;
}

/**
 * Formats ISO timestamp to human-friendly relative time (e.g. "3 days ago")
 */
export function formatRelativeTime(dateStr: string): string {
  try {
    const past = new Date(dateStr);
    if (isNaN(past.getTime())) return 'Recently';

    const now = new Date();
    const diffMs = now.getTime() - past.getTime();

    // Prevent negative display if slight clock skew
    if (diffMs < 60 * 1000 && diffMs >= 0) {
      return 'just now';
    }

    const diffMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));
    if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 60) {
      return `${diffDays} days ago`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    }

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
  } catch {
    return 'Recently';
  }
}

export function DocketEntryCard({ entry }: DocketEntryCardProps) {
  const isApproved = entry.humanDecision === 'APPROVED';

  return (
    <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-start justify-between gap-3 text-left">
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* Small colored tag for humanDecision ('APPROVED' = green, 'DENIED' = red) */}
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
              isApproved
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isApproved ? (
              <ShieldCheck className="w-3 h-3 shrink-0" />
            ) : (
              <ShieldAlert className="w-3 h-3 shrink-0" />
            )}
            <span>{entry.humanDecision}</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {formatRelativeTime(entry.createdAt)}
          </span>
        </div>
        {/* Plain text summary */}
        <p className="text-xs text-slate-300 leading-relaxed font-normal">
          {entry.summary}
        </p>
      </div>
    </div>
  );
}

export interface DocketPanelProps {
  category?: string;
  entries?: DocketEntry[];
  fallbackEntries?: DocketEntry[];
  className?: string;
}

export function DocketPanel({
  category = 'transfer',
  entries: propEntries,
  fallbackEntries,
  className = '',
}: DocketPanelProps) {
  const [items, setItems] = useState<DocketEntry[]>(propEntries || fallbackEntries || []);
  const [isLoading, setIsLoading] = useState<boolean>(!propEntries || propEntries.length === 0);

  useEffect(() => {
    let isMounted = true;

    async function fetchDocketPrecedents() {
      setIsLoading(true);
      try {
        const queryCategory = category || 'transfer';
        const response = await fetch(
          `${API_BASE_URL}/docket/search?category=${encodeURIComponent(queryCategory)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch docket: HTTP ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          if (Array.isArray(data) && data.length > 0) {
            setItems(data.slice(0, 5));
          } else if (fallbackEntries && fallbackEntries.length > 0) {
            setItems(fallbackEntries.slice(0, 5));
          } else if (propEntries && propEntries.length > 0) {
            setItems(propEntries.slice(0, 5));
          }
        }
      } catch (err) {
        console.warn('[DocketPanel] Error fetching docket entries:', err);
        if (isMounted) {
          if (fallbackEntries && fallbackEntries.length > 0) {
            setItems(fallbackEntries.slice(0, 5));
          } else if (propEntries && propEntries.length > 0) {
            setItems(propEntries.slice(0, 5));
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDocketPrecedents();

    return () => {
      isMounted = false;
    };
  }, [category, propEntries, fallbackEntries]);

  const displayedEntries = items.slice(0, 5);

  return (
    <div className={`glass-panel-subtle p-4 space-y-3 ${className}`}>
      {/* Visually secondary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <History className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          <h3 className="text-xs font-semibold text-slate-300 tracking-wide">
            Similar past cases from the Docket
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-500" />}
          <span className="text-[11px] text-slate-500 font-mono">
            {displayedEntries.length} {displayedEntries.length === 1 ? 'precedent' : 'precedents'}
          </span>
        </div>
      </div>

      {/* Entry Cards List */}
      <div className="space-y-2">
        {displayedEntries.map((entry) => (
          <DocketEntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
