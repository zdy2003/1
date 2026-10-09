import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data", "docguard.db");

let _db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!_db) {
    const { existsSync, mkdirSync } = require("fs");
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT DEFAULT '' NOT NULL,
      status TEXT DEFAULT '进行中' NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      file_name TEXT NOT NULL,
      tender_file_name TEXT,
      file_key TEXT NOT NULL,
      tender_file_key TEXT,
      status TEXT DEFAULT 'running' NOT NULL,
      score INTEGER,
      high_count INTEGER DEFAULT 0 NOT NULL,
      medium_count INTEGER DEFAULT 0 NOT NULL,
      low_count INTEGER DEFAULT 0 NOT NULL,
      summary TEXT,
      result_json TEXT,
      error TEXT,
      response_id TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      enabled INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT '已邀请' NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
