import Database from 'better-sqlite3';
import { getDb } from './index';

export function seedAgents(dbInstance?: Database.Database): void {
  const db = dbInstance || getDb();

  const insertAgent = db.prepare(`
    INSERT INTO agents (id, wallet_address, display_name, verification_status, transaction_limit, review_threshold, created_at)
    VALUES (@id, @wallet_address, @display_name, @verification_status, @transaction_limit, @review_threshold, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      wallet_address = excluded.wallet_address,
      display_name = excluded.display_name,
      verification_status = excluded.verification_status,
      transaction_limit = excluded.transaction_limit,
      review_threshold = excluded.review_threshold
  `);

  const insertCapability = db.prepare(`
    INSERT OR IGNORE INTO agent_capabilities (id, agent_id, capability, created_at)
    VALUES (@id, @agent_id, @capability, @created_at)
  `);

  const tx = db.transaction(() => {
    // 1. Agent Alpha (verified, capable, clean history)
    insertAgent.run({
      id: 'agent-alpha',
      wallet_address: '0x1111111111111111111111111111111111111111',
      display_name: 'Agent Alpha',
      verification_status: 'verified',
      transaction_limit: 1000.0,
      review_threshold: 200.0,
      created_at: new Date().toISOString(),
    });

    insertCapability.run({
      id: 'cap-alpha-transfer',
      agent_id: 'agent-alpha',
      capability: 'transfer',
      created_at: new Date().toISOString(),
    });

    insertCapability.run({
      id: 'cap-alpha-payment',
      agent_id: 'agent-alpha',
      capability: 'payment',
      created_at: new Date().toISOString(),
    });

    insertCapability.run({
      id: 'cap-alpha-swap',
      agent_id: 'agent-alpha',
      capability: 'swap',
      created_at: new Date().toISOString(),
    });

    // 2. Agent Shadow (unverified, zero limit, no declared capabilities)
    insertAgent.run({
      id: 'agent-shadow',
      wallet_address: '0x9999999999999999999999999999999999999999',
      display_name: 'Agent Shadow',
      verification_status: 'unverified',
      transaction_limit: 0.0,
      review_threshold: 0.0,
      created_at: new Date().toISOString(),
    });

    // 3. Agent Sentinel (verified, soft review threshold for Scenario C)
    insertAgent.run({
      id: 'agent-sentinel',
      wallet_address: '0x9816B956cD8673aE483A61cfd515a774f8E625b1',
      display_name: 'Agent Sentinel',
      verification_status: 'verified',
      transaction_limit: 100.0,
      review_threshold: 1.0,
      created_at: new Date().toISOString(),
    });

    insertCapability.run({
      id: 'cap-sentinel-transfer',
      agent_id: 'agent-sentinel',
      capability: 'transfer',
      created_at: new Date().toISOString(),
    });

    insertCapability.run({
      id: 'cap-sentinel-payment',
      agent_id: 'agent-sentinel',
      capability: 'payment',
      created_at: new Date().toISOString(),
    });
  });

  tx();
  console.log('[Verdict DB] Seeded demo agents (Agent Alpha, Agent Shadow, Agent Sentinel)');
}

if (require.main === module) {
  seedAgents();
}
