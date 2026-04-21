# Gamaguchi — Portfolio Tracker with AI Intelligence

## What It Is

A local desktop app (Electrobun + SolidJS) for manually tracking crypto portfolios with AI-driven analysis and in-app signals. Sole user. No exchange sync. No OS notifications (yet).

## Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Electrobun (Bun-based, macOS) |
| Frontend | SolidJS + Vite |
| Persistence | SQLite via `bun:sqlite` |
| Market data | CoinGecko (primary) + Kraken public API (secondary), with rotation on rate limit |
| AI analysis | Claude API (`claude-sonnet-4-6`) via Anthropic SDK |
| Secrets | `.env` (Bun auto-loads, never crosses IPC to renderer) |

## Core Features

- Create and manage multiple portfolios
- Live asset search → add holdings manually (symbol, quantity, avg cost basis)
- On-demand portfolio analysis via Claude → structured signals
- Per-signal lazy "Explain" — short label shown by default, full Claude explanation loaded on demand and cached
- In-app signals only (rule-based + LLM-decided)

## SQLite Schema

```sql
portfolios       (id, name, description, created_at)
holdings         (id, portfolio_id, symbol, name, quantity, avg_cost_basis, added_at)
price_cache      (symbol, provider, price_usd, change_24h, change_7d, volume_24h, market_cap, fetched_at)
analysis_results (id, portfolio_id, created_at, model, summary, signals_json)
signal_details   (id, analysis_id, signal_index, explanation, created_at)
```

`signals_json` shape: `Array<{ severity: 'low'|'medium'|'high', asset: string, short_label: string, context: string }>`

## Data Provider Strategy

```
ProviderManager
  primary:   CoinGecko  — search, market cap, price history
  secondary: Kraken     — real-time price, OHLCV
  rotation:  on 429 or rate limit error, failover to next provider
```

Keys live in `.env`. Keyless CoinGecko to start (30 req/min); add key if limits are hit.

## Signal UX

Each signal shows a short label + severity badge. "Explain" fires a single Claude call with the signal's context + recent price data. Response renders inline and is written to `signal_details` so re-opening does not re-call Claude.

## File Structure

```
src/
  bun/
    index.ts                 — main process, all IPC handlers
    db/
      schema.ts              — CREATE TABLE + migrations
      queries.ts             — typed query functions
    providers/
      types.ts               — shared interfaces (Asset, PriceData, OHLCV)
      coingecko.ts
      kraken.ts
      manager.ts             — rotation + rate limit tracking
    analysis/
      claude.ts              — portfolio analysis → structured signals
      prompts.ts             — system + user prompt templates
  mainview/
    index.html
    src/
      App.tsx
      components/
        PortfolioList.tsx
        PortfolioDetail.tsx
        HoldingsTable.tsx
        AssetSearch.tsx      — live search → add holding
        AnalysisPanel.tsx    — trigger analysis, render signals
        SignalCard.tsx       — short signal + lazy Explain button
```

## Build Order

- [x] **Step 1** — `feat/01-db-schema` — SQLite schema + typed queries
- [x] **Step 2** — `feat/02-providers` — CoinGecko + Kraken + ProviderManager rotation
- [x] **Step 3** — `feat/03-ipc` — typed IPC contracts between Bun main and SolidJS renderer
- [x] **Step 4** — `feat/04-core-ui` — portfolio CRUD, holdings table, asset search
- [x] **Step 5** — `feat/05-analysis` — Claude integration, signal generation
- [x] **Step 6** — `feat/06-signals-ux` — SignalCard, lazy Explain, signal caching

## Future / Out of Scope for Now

- Exchange/wallet sync (Coinbase, Binance, etc.)
- OS push notifications
- Cloud-based CRON scheduling for automated analysis
- Stock support (equities)
- Multi-user / auth
