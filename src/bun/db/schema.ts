import { Database } from "bun:sqlite";

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  _db = new Database("gamaguchi.db", { create: true });
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA foreign_keys = ON");

  migrate(_db);

  return _db;
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS holdings (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id   INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      symbol         TEXT    NOT NULL,
      name           TEXT    NOT NULL,
      quantity       REAL    NOT NULL,
      avg_cost_basis REAL    NOT NULL,
      added_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_cache (
      symbol      TEXT    NOT NULL,
      provider    TEXT    NOT NULL,
      price_usd   REAL    NOT NULL,
      change_24h  REAL,
      change_7d   REAL,
      volume_24h  REAL,
      market_cap  REAL,
      fetched_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (symbol, provider)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      model        TEXT    NOT NULL,
      summary      TEXT    NOT NULL,
      signals_json TEXT    NOT NULL DEFAULT '[]',
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS signal_details (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id  INTEGER NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE,
      signal_index INTEGER NOT NULL,
      explanation  TEXT    NOT NULL,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (analysis_id, signal_index)
    )
  `);
}
