import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.VERDICT_DB_PATH || path.resolve(process.cwd(), 'verdict.db');
    // Ensure parent directory exists (critical for persistent volume mounts like /data/verdict.db)
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new Database(dbPath);
    // Enable WAL mode for better concurrency and enforce foreign key constraints
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
}

export function initSchema(): void {
  const db = getDb();

  // Multi-path resolution for schema.sql (works in both tsx dev and compiled dist/ production)
  const candidateSchemaPaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'apps/api/src/db/schema.sql'),
  ];
  const schemaPath = candidateSchemaPaths.find((p) => fs.existsSync(p));

  if (!schemaPath) {
    throw new Error(`Schema file not found. Checked candidate paths: ${candidateSchemaPaths.join(', ')}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Multi-path resolution for migrations directory
  const candidateMigrationDirs = [
    path.resolve(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'apps/api/src/db/migrations'),
  ];
  const migrationsDir = candidateMigrationDirs.find((d) => fs.existsSync(d));

  if (migrationsDir) {
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(migrationSql);
    }
  }

  // Seed default agents (Agent Alpha, Agent Shadow, Agent Sentinel)
  const { seedAgents } = require('./seed');
  seedAgents(db);

  console.log('[Verdict DB] Schema and migrations initialized successfully (5 tables ready)');
}
