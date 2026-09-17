import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Agent, VerificationStatus } from '@verdict/shared';
import { getDb } from '../db';

export const agentsRouter = Router();

const createAgentSchema = z.object({
  walletAddress: z.string().min(1, 'walletAddress is required'),
  displayName: z.string().min(1, 'displayName is required'),
  capabilities: z.array(z.string()),
  verificationStatus: z.enum(['verified', 'unverified', 'flagged']),
  transactionLimit: z.number().nonnegative(),
  reviewThreshold: z.number().nonnegative(),
});

interface AgentRow {
  id: string;
  wallet_address: string;
  display_name: string;
  verification_status: VerificationStatus;
  transaction_limit: number;
  review_threshold: number;
  created_at: string;
}

/**
 * POST /agents
 * Register an agent in SQLite
 */
agentsRouter.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createAgentSchema.parse(req.body);
    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM agents WHERE wallet_address = ?')
      .get(parsed.walletAddress) as { id: string } | undefined;
    const id = existing ? existing.id : `agent-${Date.now()}`;
    const createdAt = new Date().toISOString();

    const insertAgent = db.prepare(`
      INSERT INTO agents (id, wallet_address, display_name, verification_status, transaction_limit, review_threshold, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        display_name = excluded.display_name,
        verification_status = excluded.verification_status,
        transaction_limit = excluded.transaction_limit,
        review_threshold = excluded.review_threshold
    `);

    const insertCap = db.prepare(`
      INSERT OR IGNORE INTO agent_capabilities (id, agent_id, capability, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertAgent.run(
        id,
        parsed.walletAddress,
        parsed.displayName,
        parsed.verificationStatus,
        parsed.transactionLimit,
        parsed.reviewThreshold,
        createdAt
      );

      for (const cap of parsed.capabilities) {
        insertCap.run(`cap-${id}-${cap}`, id, cap, createdAt);
      }
    });

    tx();

    const createdAgent: Agent = {
      id,
      walletAddress: parsed.walletAddress,
      displayName: parsed.displayName,
      capabilities: parsed.capabilities,
      verificationStatus: parsed.verificationStatus,
      transactionLimit: parsed.transactionLimit,
      reviewThreshold: parsed.reviewThreshold,
      createdAt,
    };

    return res.status(201).json(createdAgent);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /agents
 * List all registered agents (non-breaking additive endpoint)
 */
agentsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as AgentRow[];

  const agents: Agent[] = rows.map((agentRow) => {
    const capRows = db
      .prepare('SELECT capability FROM agent_capabilities WHERE agent_id = ?')
      .all(agentRow.id) as Array<{ capability: string }>;

    return {
      id: agentRow.id,
      walletAddress: agentRow.wallet_address,
      displayName: agentRow.display_name,
      capabilities: capRows.map((c) => c.capability),
      verificationStatus: agentRow.verification_status,
      transactionLimit: agentRow.transaction_limit,
      reviewThreshold: agentRow.review_threshold,
      createdAt: agentRow.created_at,
    };
  });

  return res.json(agents);
});

/**
 * GET /agents/:id
 * Fetch agent passport from SQLite
 */
agentsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const agentRow = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(id) as AgentRow | undefined;

  if (!agentRow) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const capRows = db
    .prepare('SELECT capability FROM agent_capabilities WHERE agent_id = ?')
    .all(id) as Array<{ capability: string }>;

  const agent: Agent = {
    id: agentRow.id,
    walletAddress: agentRow.wallet_address,
    displayName: agentRow.display_name,
    capabilities: capRows.map((c) => c.capability),
    verificationStatus: agentRow.verification_status,
    transactionLimit: agentRow.transaction_limit,
    reviewThreshold: agentRow.review_threshold,
    createdAt: agentRow.created_at,
  };

  return res.json(agent);
});
