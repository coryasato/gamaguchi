import { getDb } from "./schema";
import type {
  Portfolio,
  Holding,
  PriceCache,
  AnalysisResult,
  AnalysisResultParsed,
  SignalDetail,
  Signal,
} from "./types";

// ─── Portfolios ───────────────────────────────────────────────────────────────

export function listPortfolios(): Portfolio[] {
  return getDb().query<Portfolio, []>("SELECT * FROM portfolios ORDER BY created_at ASC").all();
}

export function getPortfolio(id: number): Portfolio | null {
  return getDb().query<Portfolio, [number]>("SELECT * FROM portfolios WHERE id = ?").get(id);
}

export function createPortfolio(name: string, description = ""): Portfolio {
  const db = getDb();
  db.run("INSERT INTO portfolios (name, description) VALUES (?, ?)", [name, description]);
  return db.query<Portfolio, []>("SELECT * FROM portfolios WHERE id = last_insert_rowid()").get()!;
}

export function updatePortfolio(id: number, name: string, description: string): void {
  getDb().run("UPDATE portfolios SET name = ?, description = ? WHERE id = ?", [name, description, id]);
}

export function deletePortfolio(id: number): void {
  getDb().run("DELETE FROM portfolios WHERE id = ?", [id]);
}

// ─── Holdings ─────────────────────────────────────────────────────────────────

export function listHoldings(portfolioId: number): Holding[] {
  return getDb()
    .query<Holding, [number]>("SELECT * FROM holdings WHERE portfolio_id = ? ORDER BY added_at ASC")
    .all(portfolioId);
}

export function addHolding(
  portfolioId: number,
  symbol: string,
  name: string,
  quantity: number,
  avgCostBasis: number,
): Holding {
  const db = getDb();
  db.run(
    "INSERT INTO holdings (portfolio_id, symbol, name, quantity, avg_cost_basis) VALUES (?, ?, ?, ?, ?)",
    [portfolioId, symbol.toUpperCase(), name, quantity, avgCostBasis],
  );
  return db.query<Holding, []>("SELECT * FROM holdings WHERE id = last_insert_rowid()").get()!;
}

export function updateHolding(id: number, quantity: number, avgCostBasis: number): void {
  getDb().run("UPDATE holdings SET quantity = ?, avg_cost_basis = ? WHERE id = ?", [quantity, avgCostBasis, id]);
}

export function deleteHolding(id: number): void {
  getDb().run("DELETE FROM holdings WHERE id = ?", [id]);
}

// ─── Price Cache ──────────────────────────────────────────────────────────────

// Max age in minutes before a cached price is considered stale
const PRICE_CACHE_TTL_MINUTES = 2;

export function getCachedPrice(symbol: string): PriceCache | null {
  return getDb()
    .query<PriceCache, [string, number]>(
      `SELECT * FROM price_cache
       WHERE symbol = ?
         AND (julianday('now') - julianday(fetched_at)) * 1440 < ?
       ORDER BY fetched_at DESC
       LIMIT 1`,
    )
    .get(symbol.toUpperCase(), PRICE_CACHE_TTL_MINUTES);
}

export function upsertPriceCache(data: Omit<PriceCache, "fetched_at">): void {
  getDb().run(
    `INSERT INTO price_cache (symbol, provider, price_usd, change_24h, change_7d, volume_24h, market_cap, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (symbol, provider) DO UPDATE SET
       price_usd  = excluded.price_usd,
       change_24h = excluded.change_24h,
       change_7d  = excluded.change_7d,
       volume_24h = excluded.volume_24h,
       market_cap = excluded.market_cap,
       fetched_at = excluded.fetched_at`,
    [data.symbol.toUpperCase(), data.provider, data.price_usd, data.change_24h, data.change_7d, data.volume_24h, data.market_cap],
  );
}

// ─── Analysis Results ─────────────────────────────────────────────────────────

export function listAnalysisResults(portfolioId: number): AnalysisResultParsed[] {
  const rows = getDb()
    .query<AnalysisResult, [number]>(
      "SELECT * FROM analysis_results WHERE portfolio_id = ? ORDER BY created_at DESC",
    )
    .all(portfolioId);
  return rows.map(parseAnalysis);
}

export function getLatestAnalysis(portfolioId: number): AnalysisResultParsed | null {
  const row = getDb()
    .query<AnalysisResult, [number]>(
      "SELECT * FROM analysis_results WHERE portfolio_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(portfolioId);
  return row ? parseAnalysis(row) : null;
}

export function saveAnalysisResult(
  portfolioId: number,
  model: string,
  summary: string,
  signals: Signal[],
): AnalysisResultParsed {
  const db = getDb();
  db.run(
    "INSERT INTO analysis_results (portfolio_id, model, summary, signals_json) VALUES (?, ?, ?, ?)",
    [portfolioId, model, summary, JSON.stringify(signals)],
  );
  const row = db.query<AnalysisResult, []>("SELECT * FROM analysis_results WHERE id = last_insert_rowid()").get()!;
  return parseAnalysis(row);
}

// ─── Signal Details ───────────────────────────────────────────────────────────

export function getSignalDetail(analysisId: number, signalIndex: number): SignalDetail | null {
  return getDb()
    .query<SignalDetail, [number, number]>(
      "SELECT * FROM signal_details WHERE analysis_id = ? AND signal_index = ?",
    )
    .get(analysisId, signalIndex);
}

export function saveSignalDetail(
  analysisId: number,
  signalIndex: number,
  explanation: string,
): SignalDetail {
  const db = getDb();
  db.run(
    `INSERT INTO signal_details (analysis_id, signal_index, explanation)
     VALUES (?, ?, ?)
     ON CONFLICT (analysis_id, signal_index) DO UPDATE SET explanation = excluded.explanation`,
    [analysisId, signalIndex, explanation],
  );
  return db
    .query<SignalDetail, [number, number]>(
      "SELECT * FROM signal_details WHERE analysis_id = ? AND signal_index = ?",
    )
    .get(analysisId, signalIndex)!;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAnalysis(row: AnalysisResult): AnalysisResultParsed {
  const { signals_json, ...rest } = row;
  return { ...rest, signals: JSON.parse(signals_json) as Signal[] };
}
