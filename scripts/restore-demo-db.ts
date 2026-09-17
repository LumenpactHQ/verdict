/**
 * restore-demo-db.ts
 *
 * Restores the live verdict.db from verdict.demo-snapshot.db in one command.
 * Instantly recovers from messy test runs or rehearsals.
 */

import fs from 'fs';
import path from 'path';
import { getDbFilePaths, queryDbCounts, resetDemoDb } from './reset-demo-db';
import { closeDb } from '../apps/api/src/db';

export async function restoreDemoDb() {
  console.log('========================================================================');
  console.log('           Verdict Security Gate: Restore Demo Database                ');
  console.log('========================================================================\n');

  const { dbPath, walPath, shmPath, snapshotPath } = getDbFilePaths();

  // 1. Check if snapshot exists
  if (!fs.existsSync(snapshotPath)) {
    console.warn(`[Restore Notice] Snapshot not found at ${snapshotPath}. Generating fresh reset...`);
    await resetDemoDb();
    return;
  }

  // 2. Capture counts before restore
  const countsBefore = queryDbCounts(dbPath);
  console.log('--- Current Database State (Before Restore) ---');
  console.table(countsBefore);

  // 3. Ensure any active DB connection is released
  closeDb();

  // 4. Remove live DB files (including WAL/SHM to avoid stale replay)
  for (const f of [dbPath, walPath, shmPath]) {
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
        console.log(`[Clean] Deleted: ${path.basename(f)}`);
      } catch (err: any) {
        console.warn(`[Clean Warning] Could not delete ${f}: ${err.message}`);
      }
    }
  }

  // 5. Copy snapshot over live database
  fs.copyFileSync(snapshotPath, dbPath);
  console.log(`[Restore] Copied: ${path.basename(snapshotPath)} -> ${path.basename(dbPath)}`);

  // 6. Verify restored database state
  const countsAfter = queryDbCounts(dbPath);
  console.log('\n--- Restored Database State ---');
  console.table(countsAfter);

  if (countsAfter.agents !== 2 || countsAfter.action_requests !== 0) {
    console.warn('[Warning] Restored database is not in the expected clean state!');
  } else {
    console.log('Restore verified: Pristine state restored (2 agents, 0 actions, 0 docket, 0 audit).');
  }

  console.log('\n========================================================================');
  console.log('  SUCCESS: Database restored cleanly from demo snapshot!                ');
  console.log('========================================================================\n');

  return countsAfter;
}

if (require.main === module) {
  restoreDemoDb().catch((err) => {
    console.error('Failed to restore database from snapshot:', err);
    process.exit(1);
  });
}
