import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { ActionRequest, Decision, ActionRequestStatus } from '@verdict/shared';
import { getDb } from '../db';
import { executeTransfer, Hex } from '../chain';

export const actionsRouter = Router();

const executeSchema = z.object({
  actionRequestId: z.string().min(1, 'actionRequestId is required'),
  authorizationToken: z.string().min(1, 'authorizationToken is required'),
});

const reviewSchema = z.object({
  approve: z.boolean(),
});

interface ActionRequestRow {
  id: string;
  agent_id: string;
  action_type: string;
  target_address: string;
  amount: number;
  token: string;
  decision: Decision;
  reasons: string;
  authorization_token: string | null;
  token_expires_at: string | null;
  token_consumed: number;
  tx_hash: string | null;
  status: ActionRequestStatus;
  created_at: string;
}

function mapRowToActionRequest(row: ActionRequestRow): ActionRequest {
  let reasons: string[] = [];
  try {
    reasons = JSON.parse(row.reasons);
  } catch {
    reasons = [row.reasons];
  }

  return {
    id: row.id,
    agentId: row.agent_id,
    actionType: row.action_type,
    targetAddress: row.target_address,
    amount: row.amount,
    token: row.token,
    decision: row.decision,
    reasons,
    authorizationToken: row.authorization_token,
    tokenExpiresAt: row.token_expires_at,
    tokenConsumed: row.token_consumed === 1,
    txHash: row.tx_hash,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * POST /actions/execute
 * Execute only with a valid, unexpired authorization_token backed by real SQLite lookup.
 * - 400: Malformed/missing request body fields (Zod validation error)
 * - 403: Body is well-formed, but token is invalid, expired, consumed, or mismatched
 * - 200: Token verified -> atomically marks token consumed, calls chain stub, returns updated ActionRequest
 */
actionsRouter.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = executeSchema.parse(req.body);
    const db = getDb();

    // 1. Fetch action_request by ID
    const row = db
      .prepare('SELECT * FROM action_requests WHERE id = ?')
      .get(input.actionRequestId) as ActionRequestRow | undefined;

    if (!row) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Action request not found or invalid authorization token',
      });
    }

    // 2. Token must exist on the row (REJECT or unapproved actions have no token)
    if (!row.authorization_token || row.authorization_token !== input.authorizationToken) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or mismatched authorization token',
      });
    }

    // 3. Token must not be already consumed
    if (row.token_consumed === 1) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authorization token has already been consumed',
      });
    }

    // 4. Token must not be expired
    if (!row.token_expires_at || new Date(row.token_expires_at).getTime() <= Date.now()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Authorization token has expired',
      });
    }

    // 5. Decision must be ALLOW
    if (row.decision !== 'ALLOW') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot execute an action that was not granted ALLOW verdict',
      });
    }

    // 6. Claim step (atomic, happens first before chain call to prevent concurrency double-spend race)
    const claimStmt = db.prepare(`
      UPDATE action_requests
      SET status = 'EXECUTING'
      WHERE id = ?
        AND authorization_token = ?
        AND token_consumed = 0
        AND status = 'APPROVED'
        AND datetime(token_expires_at) > datetime('now')
    `);

    const claimResult = claimStmt.run(row.id, input.authorizationToken);

    if (claimResult.changes === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Action request cannot be executed (already executing, consumed, expired, or claimed)',
      });
    }

    // 7. Only the single request that won the claim reaches the chain call
    let txHash: string;
    try {
      txHash = await executeTransfer(row.target_address as Hex, row.amount);
    } catch (chainErr) {
      // Chain failure: Roll back status to APPROVED and leave token_consumed = 0 (retryable)
      db.prepare(`
        UPDATE action_requests
        SET status = 'APPROVED'
        WHERE id = ? AND status = 'EXECUTING'
      `).run(row.id);

      // Record failure in audit trail
      db.prepare(`
        INSERT INTO audit_trail_entries (id, action_request_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        row.id,
        'CHAIN_EXECUTION_FAILED',
        JSON.stringify({
          error: chainErr instanceof Error ? chainErr.message : String(chainErr),
          targetAddress: row.target_address,
          amount: row.amount,
          token: row.token,
        }),
        new Date().toISOString()
      );

      return res.status(502).json({
        error: 'ChainExecutionError',
        message: `On-chain transfer execution failed: ${chainErr instanceof Error ? chainErr.message : 'Unknown error'}`,
        actionRequestId: row.id,
        retryable: true,
        tokenConsumed: false,
      });
    }

    // 8. On chain success: atomically mark token consumed and record tx_hash
    const finalizeStmt = db.prepare(`
      UPDATE action_requests
      SET token_consumed = 1,
          status = 'EXECUTED',
          tx_hash = ?
      WHERE id = ? AND status = 'EXECUTING'
    `);

    const finalizeResult = finalizeStmt.run(txHash, row.id);

    if (finalizeResult.changes === 0) {
      // Row was not in EXECUTING state when attempting to finalize
      const currentRow = db
        .prepare('SELECT status, token_consumed, tx_hash FROM action_requests WHERE id = ?')
        .get(row.id) as { status: string; token_consumed: number; tx_hash: string | null } | undefined;

      db.prepare(`
        INSERT INTO audit_trail_entries (id, action_request_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        row.id,
        'FINALIZE_INTEGRITY_ERROR',
        JSON.stringify({
          expectedStatus: 'EXECUTING',
          foundStatus: currentRow?.status ?? 'ROW_NOT_FOUND',
          tokenConsumed: currentRow?.token_consumed ?? null,
          txHash,
        }),
        new Date().toISOString()
      );

      return res.status(500).json({
        error: 'FinalizeIntegrityError',
        message: `Database integrity error: could not finalize action ${row.id} (row was not in EXECUTING state)`,
        actionRequestId: row.id,
        currentState: currentRow ?? null,
      });
    }

    // 9. Record success in audit trail
    db.prepare(`
      INSERT INTO audit_trail_entries (id, action_request_id, event_type, details, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      row.id,
      'ACTION_EXECUTED',
      JSON.stringify({ txHash, amount: row.amount, token: row.token }),
      new Date().toISOString()
    );

    // 10. Fetch and return updated action request
    const updatedRow = db
      .prepare('SELECT * FROM action_requests WHERE id = ?')
      .get(row.id) as ActionRequestRow;

    return res.json(mapRowToActionRequest(updatedRow));
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /actions
 * List all past requests (newest first) from SQLite
 */
actionsRouter.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM action_requests ORDER BY created_at DESC')
    .all() as ActionRequestRow[];

  return res.json(rows.map(mapRowToActionRequest));
});

/**
 * GET /actions/:id
 * View a single decision + audit trail from SQLite
 */
actionsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id) as
    | ActionRequestRow
    | undefined;

  if (!row) {
    return res.status(404).json({ error: 'Action request not found' });
  }

  const action = mapRowToActionRequest(row);

  // Attach full audit trail
  const auditRows = db
    .prepare('SELECT * FROM audit_trail_entries WHERE action_request_id = ? ORDER BY timestamp ASC')
    .all(id) as Array<{
      id: string;
      action_request_id: string;
      event_type: string;
      details: string;
      timestamp: string;
    }>;

  action.auditTrail = auditRows.map((a) => {
    let details: Record<string, unknown> | string = a.details;
    try {
      details = JSON.parse(a.details);
    } catch {
      details = a.details;
    }
    return {
      id: a.id,
      actionRequestId: a.action_request_id,
      eventType: a.event_type,
      details,
      timestamp: a.timestamp,
    };
  });

  return res.json(action);
});

/**
 * POST /actions/:id/review
 * Human approves/denies a REVIEW-state request; writes a Docket entry.
 * If approved, generates and issues a fresh authorizationToken.
 */
actionsRouter.post('/:id/review', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { approve } = reviewSchema.parse(req.body);
    const db = getDb();

    const row = db.prepare('SELECT * FROM action_requests WHERE id = ?').get(id) as
      | ActionRequestRow
      | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Action request not found' });
    }

    const now = new Date();
    const freshToken = approve ? `vtok_${crypto.randomBytes(24).toString('hex')}` : null;
    const tokenExpiresAt = approve ? new Date(now.getTime() + 5 * 60 * 1000).toISOString() : null;
    const newDecision: Decision = approve ? 'ALLOW' : 'REJECT';
    const newStatus: ActionRequestStatus = approve ? 'APPROVED' : 'REJECTED';

    let existingReasons: string[] = [];
    try {
      existingReasons = JSON.parse(row.reasons);
    } catch {
      existingReasons = [row.reasons];
    }

    const reviewReason = approve
      ? 'Human reviewer approved request via Docket review'
      : 'Human reviewer denied request after policy inspection';
    const updatedReasons = [...existingReasons, reviewReason];

    const tx = db.transaction(() => {
      // 1. Update action request
      db.prepare(`
        UPDATE action_requests
        SET decision = ?,
            status = ?,
            reasons = ?,
            authorization_token = ?,
            token_expires_at = ?,
            token_consumed = 0
        WHERE id = ?
      `).run(newDecision, newStatus, JSON.stringify(updatedReasons), freshToken, tokenExpiresAt, id);

      // 2. Insert docket entry
      db.prepare(`
        INSERT INTO docket_entries (id, action_request_id, category, summary, human_decision, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `doc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        id,
        row.action_type,
        reviewReason,
        approve ? 'APPROVED' : 'DENIED',
        now.toISOString()
      );

      // 3. Insert audit entry
      db.prepare(`
        INSERT INTO audit_trail_entries (id, action_request_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        id,
        'HUMAN_REVIEW',
        JSON.stringify({ approve, decision: newDecision }),
        now.toISOString()
      );
    });

    tx();

    const updatedRow = db
      .prepare('SELECT * FROM action_requests WHERE id = ?')
      .get(id) as ActionRequestRow;

    return res.json(mapRowToActionRequest(updatedRow));
  } catch (err) {
    return next(err);
  }
});
