import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.VERDICT_DB_PATH || path.resolve(process.cwd(), 'verdict.db');
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
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Apply migrations
  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(migrationSql);
    }
  }

  // Seed default agents (Agent Alpha & Agent Shadow)
  const { seedAgents } = require('./seed');
  seedAgents(db);

  console.log('[Verdict DB] Schema and migrations initialized successfully (5 tables ready)');
}
