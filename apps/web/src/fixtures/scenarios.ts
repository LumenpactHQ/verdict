import type { Agent, Decision, DocketEntry } from '@verdict/shared';
import { mockAgents } from './agents';
import { mockDocketEntries } from './docket';

export interface CheckItem {
  id: string;
  label: string;
  detail: string;
  status: 'pass' | 'fail' | 'pending';
}

export interface DemoScenario {
  id: 'alpha' | 'shadow' | 'sentinel';
  title: string;
  subtitle: string;
  agent: Agent;
  actionDescription: string;
  recipientAddress: string;
  amount: number;
  token: string;
  decision: Decision;
  reasons: string[];
  txHash: string | null;
  authorizationToken: string | null;
  checks: CheckItem[];
  docketMatches?: DocketEntry[];
}

export const demoScenarios: Record<'alpha' | 'shadow' | 'sentinel', DemoScenario> = {
  alpha: {
    id: 'alpha',
    title: 'Scenario A: Agent Alpha',
    subtitle: 'Verified agent, clean history, compliant request',
    agent: mockAgents[0], // Agent Alpha
    actionDescription: 'Send 5 USDC to 0x8f2...c91',
    recipientAddress: '0x8f2c069b2d8e4f16a04efc381c815ecdf3487c91',
    amount: 5,
    token: 'USDC',
    decision: 'ALLOW',
    reasons: ['All 5 security gates passed unconditionally'],
    txHash: '0x7a3f81c902b4d7e9b048593a19e5c46b9a8e2d7c5b3a10e4f8d6c7b9a0e1f234',
    authorizationToken: 'auth_tok_alpha_7f81c902_live',
    checks: [
      { id: 'c1', label: 'Identity verified', detail: 'Base Sepolia on-chain registry', status: 'pass' },
      { id: 'c2', label: 'Capability declared', detail: 'PAYMENT capability active', status: 'pass' },
      { id: 'c3', label: 'Within transaction limit', detail: '5 of 50 USDC limit', status: 'pass' },
      { id: 'c4', label: 'Recipient trusted', detail: 'Known recipient address', status: 'pass' },
      { id: 'c5', label: 'No reputation flags', detail: '0 security flags detected', status: 'pass' },
    ],
  },
  shadow: {
    id: 'shadow',
    title: 'Scenario B: Agent Shadow',
    subtitle: 'Unverified agent, missing capability, out of bounds',
    agent: mockAgents[1], // Agent Shadow
    actionDescription: 'Send 500 USDC to 0x321...f4a',
    recipientAddress: '0x321a8b6e5d9c1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
    amount: 500,
    token: 'USDC',
    decision: 'REJECT',
    reasons: [
      'Blocked — agent is unverified and has not declared payment capability',
      'Blocked — amount (500 USDC) exceeds configured limit (5 USDC)',
    ],
    txHash: null,
    authorizationToken: null,
    checks: [
      { id: 'c1', label: 'Identity verified', detail: 'Unverified agent address', status: 'fail' },
      { id: 'c2', label: 'Capability declared', detail: 'No declared capabilities', status: 'fail' },
      { id: 'c3', label: 'Within transaction limit', detail: '500 exceeds 5 USDC limit', status: 'fail' },
      { id: 'c4', label: 'Recipient trusted', detail: 'Unknown counterparty', status: 'fail' },
      { id: 'c5', label: 'No reputation flags', detail: 'Anomalous burst velocity flagged', status: 'fail' },
    ],
  },
  sentinel: {
    id: 'sentinel',
    title: 'Scenario C: Agent Sentinel',
    subtitle: 'Borderline transfer above soft review threshold',
    agent: mockAgents[2], // Agent Sentinel
    actionDescription: 'Send 35 USDC to 0x44a...3a4',
    recipientAddress: '0x44a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
    amount: 35,
    token: 'USDC',
    decision: 'REVIEW',
    reasons: ['Amount (35 USDC) exceeds soft review threshold (25 USDC) — human sign-off required'],
    txHash: null,
    authorizationToken: null,
    checks: [
      { id: 'c1', label: 'Identity verified', detail: 'Verified on-chain', status: 'pass' },
      { id: 'c2', label: 'Capability declared', detail: 'PAYMENT capability active', status: 'pass' },
      { id: 'c3', label: 'Within transaction limit', detail: '35 exceeds 25 USDC threshold', status: 'pending' },
      { id: 'c4', label: 'Recipient trusted', detail: 'Known recipient address', status: 'pass' },
      { id: 'c5', label: 'No reputation flags', detail: 'Clean history (0 flags)', status: 'pass' },
    ],
    docketMatches: mockDocketEntries,
  },
};
