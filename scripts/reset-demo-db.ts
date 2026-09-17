/**
 * reset-demo-db.ts
 *
 * Resets the SQLite database to a clean, demo-ready state:
 * 1. Deletes verdict.db and any -wal/-shm files.
 * 2. Runs initSchema() and migrations fresh.
 * 3. Seeds exactly Agent Alpha (verified) and Agent Shadow (unverified).
 * 4. Confirms zero rows in action_requests, docket_entries, and audit_trail_entries.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initSchema, closeDb, getDb } from '../apps/api/src/db';

export function getDbFilePaths() {
  const dbPath = process.env.VERDICT_DB_PATH || path.resolve(process.cwd(), 'verdict.db');
  return {
    dbPath,
    walPath: `${dbPath}-wal`,
    shmPath: `${dbPath}-shm`,
    snapshotPath: dbPath.replace(/\.db$/, '.demo-snapshot.db'),
  };
}

export function queryDbCounts(dbPath: string) {
  if (!fs.existsSync(dbPath)) {
    return {
      agents: 0,
      agent_capabilities: 0,
      action_requests: 0,
      docket_entries: 0,
      audit_trail_entries: 0,
    };
  }

  const db = new Database(dbPath, { readonly: true });
  try {
    const agents = (db.prepare('SELECT count(*) as c FROM agents').get() as any)?.c ?? 0;
    const agent_capabilities = (db.prepare('SELECT count(*) as c FROM agent_capabilities').get() as any)?.c ?? 0;
    const action_requests = (db.prepare('SELECT count(*) as c FROM action_requests').get() as any)?.c ?? 0;
    const docket_entries = (db.prepare('SELECT count(*) as c FROM docket_entries').get() as any)?.c ?? 0;
    const audit_trail_entries = (db.prepare('SELECT count(*) as c FROM audit_trail_entries').get() as any)?.c ?? 0;

    return {
      agents,
      agent_capabilities,
      action_requests,
      docket_entries,
      audit_trail_entries,
    };
  } catch {
    return {
      agents: 0,
      agent_capabilities: 0,
      action_requests: 0,
      docket_entries: 0,
      audit_trail_entries: 0,
    };
  } finally {
    db.close();
  }
}

export async function resetDemoDb() {
  console.log('========================================================================');
  console.log('           Verdict Security Gate: Demo Database Reset                  ');
  console.log('========================================================================\n');

  const { dbPath, walPath, shmPath } = getDbFilePaths();

  // 1. Capture counts before reset
  const countsBefore = queryDbCounts(dbPath);
  console.log('--- Current Database State (Before Reset) ---');
  console.table(countsBefore);

  // 2. Ensure any open handles are closed
  closeDb();

  // 3. Delete existing database and journal files
  for (const file of [dbPath, walPath, shmPath]) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`[Clean] Deleted: ${path.basename(file)}`);
      } catch (err: any) {
        console.warn(`[Clean Warning] Could not unlink ${file}: ${err.message}`);
      }
    }
  }

  // 4. Run initSchema() fresh (creates tables, migrations, and seeds Alpha & Shadow)
  console.log('\n--- Initializing Fresh Schema & Demo Seeds ---');
  initSchema();

  // 5. Force WAL checkpoint and flush to disk
  const db = getDb();
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}
  closeDb();

  // 6. Inspect and verify counts after reset
  const countsAfter = queryDbCounts(dbPath);
  console.log('\n--- Fresh Database State (After Reset) ---');
  console.table(countsAfter);

  // 7. Verify demo invariants
  const verifyDb = new Database(dbPath, { readonly: true });
  try {
    const agents = verifyDb.prepare('SELECT id, display_name, verification_status FROM agents ORDER BY id ASC').all() as any[];
    console.log('\nSeeded Agents:');
    agents.forEach((a) => {
      console.log(`  - ${a.id} (${a.display_name}): ${a.verification_status}`);
    });

    if (countsAfter.agents !== 2) {
      throw new Error(`Expected exactly 2 seeded agents, found ${countsAfter.agents}`);
    }
    if (countsAfter.action_requests !== 0) {
      throw new Error(`Expected 0 action_requests, found ${countsAfter.action_requests}`);
    }
    if (countsAfter.docket_entries !== 0) {
      throw new Error(`Expected 0 docket_entries, found ${countsAfter.docket_entries}`);
    }
    if (countsAfter.audit_trail_entries !== 0) {
      throw new Error(`Expected 0 audit_trail_entries, found ${countsAfter.audit_trail_entries}`);
    }

    const agentIds = agents.map((a) => a.id);
    if (!agentIds.includes('agent-alpha') || !agentIds.includes('agent-shadow')) {
      throw new Error(`Expected agent-alpha and agent-shadow, got: ${agentIds.join(', ')}`);
    }

    console.log('\n========================================================================');
    console.log('  SUCCESS: Database successfully reset to pristine demo-ready state!   ');
    console.log('========================================================================\n');
  } finally {
    verifyDb.close();
  }

  return { countsBefore, countsAfter };
}

if (require.main === module) {
  resetDemoDb().catch((err) => {
    console.error('Failed to reset database:', err);
    process.exit(1);
  });
}
