import type { Agent } from '@verdict/shared';

export const mockAgents: Agent[] = [
  {
    id: 'agent-alpha',
    walletAddress: '0x3B2c4F789a6F9a19491bC8Fe098eE0B647184C10',
    displayName: 'Agent Alpha',
    capabilities: ['TRANSFER', 'PAYMENT', 'SWAP'],
    verificationStatus: 'verified',
    transactionLimit: 50,
    reviewThreshold: 10,
    createdAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'agent-shadow',
    walletAddress: '0x89A5F41940a430D0a4F30C9d6931E64c6792fB42',
    displayName: 'Agent Shadow',
    capabilities: [],
    verificationStatus: 'unverified',
    transactionLimit: 5,
    reviewThreshold: 2,
    createdAt: '2026-09-10T14:30:00.000Z',
  },
  {
    id: 'agent-sentinel',
    walletAddress: '0x9816B956cD8673aE483A61cfd515a774f8E625b1',
    displayName: 'Agent Sentinel',
    capabilities: ['TRANSFER', 'PAYMENT'],
    verificationStatus: 'verified',
    transactionLimit: 100,
    reviewThreshold: 25,
    createdAt: '2026-09-05T09:15:00.000Z',
  },
];

export const getAgentById = (id: string): Agent | undefined => {
  return mockAgents.find((agent) => agent.id === id);
};
