import type { DocketEntry } from '@verdict/shared';

export const mockDocketEntries: DocketEntry[] = [
  {
    id: 'doc-101',
    actionRequestId: 'act-req-901',
    category: 'THRESHOLD_EXCEEDED',
    summary: 'Agent Sentinel requested 30 USDC transfer to known vendor contract (soft threshold 25 USDC). Past performance clean.',
    humanDecision: 'APPROVED',
    createdAt: '2026-09-12T10:15:00.000Z',
  },
  {
    id: 'doc-102',
    actionRequestId: 'act-req-884',
    category: 'UNUSUAL_VOLUME',
    summary: 'Agent Alpha requested 3 bursts of 15 USDC transfers within 2 minutes during market volatility. Identity confirmed.',
    humanDecision: 'APPROVED',
    createdAt: '2026-09-11T14:40:00.000Z',
  },
  {
    id: 'doc-103',
    actionRequestId: 'act-req-762',
    category: 'NEW_RECIPIENT',
    summary: 'Agent Omega attempted 80 USDC payment to freshly deployed unverified recipient contract without audit history.',
    humanDecision: 'DENIED',
    createdAt: '2026-09-08T18:22:00.000Z',
  },
  {
    id: 'doc-104',
    actionRequestId: 'act-req-650',
    category: 'THRESHOLD_EXCEEDED',
    summary: 'Autonomous liquidity agent requested rebalance transfer 10% above daily limit without multi-sig co-signature.',
    humanDecision: 'DENIED',
    createdAt: '2026-09-06T11:05:00.000Z',
  },
];
