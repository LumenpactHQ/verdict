/**
 * snapshot-demo-db.ts
 *
 * Takes a snapshot of the current clean verdict.db to verdict.demo-snapshot.db.
 * Fast, reliable restore point for live demo rehearsals.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getDbFilePaths, queryDbCounts } from './reset-demo-db';
import { closeDb, getDb } from '../apps/api/src/db';

export async function snapshotDemoDb() {
  console.log('========================================================================');
  console.log('           Verdict Security Gate: Snapshot Demo Database               ');
  console.log('========================================================================\n');

  const { dbPath, snapshotPath } = getDbFilePaths();

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Cannot snapshot: Live database does not exist at ${dbPath}`);
  }

  // 1. Force WAL checkpoint and flush so verdict.db is fully self-contained
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}
  closeDb();

  // 2. Clean up any stale snapshot journals
  const snapshotWal = `${snapshotPath}-wal`;
  const snapshotShm = `${snapshotPath}-shm`;
  for (const f of [snapshotWal, snapshotShm]) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {}
    }
  }

  // 3. Copy live database to snapshot file
  fs.copyFileSync(dbPath, snapshotPath);
  console.log(`[Snapshot] Copied: ${path.basename(dbPath)} -> ${path.basename(snapshotPath)}`);

  // 4. Verify snapshot counts
  const snapshotCounts = queryDbCounts(snapshotPath);
  console.log('\n--- Verified Snapshot State ---');
  console.table(snapshotCounts);

  if (snapshotCounts.agents !== 3 || snapshotCounts.action_requests !== 0) {
    console.warn('[Warning] Snapshot was taken of a non-clean database state!');
    console.warn(`Agents: ${snapshotCounts.agents}, Action Requests: ${snapshotCounts.action_requests}`);
  } else {
    console.log('Snapshot verified: Pristine demo state locked (3 agents, 0 action requests).');
  }

  console.log('\n========================================================================');
  console.log(`  SNAPSHOT LOCKED: ${path.basename(snapshotPath)} ready for instant restore!`);
  console.log('========================================================================\n');

  return snapshotCounts;
}

if (require.main === module) {
  snapshotDemoDb().catch((err) => {
    console.error('Failed to take database snapshot:', err);
    process.exit(1);
  });
}
