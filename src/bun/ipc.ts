import { BrowserView } from "electrobun/bun";
import type { AppSchema } from "../shared/ipc-schema";
import type { PriceData } from "./providers/types";
import {
  listPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  listHoldings,
  addHolding,
  updateHolding,
  deleteHolding,
  listAnalysisResults,
  getAnalysisById,
  getLastCachedPrice,
  upsertPriceCache,
} from "./db/queries";
import { providers } from "./providers/manager";
import { analyzePortfolio, explainSignal } from "./analysis/grok";

export const rpc = BrowserView.defineRPC<AppSchema>({
  handlers: {
    requests: {
      // ── Portfolios ──────────────────────────────────────────────────────
      listPortfolios: () => listPortfolios(),

      getPortfolio: ({ id }) => getPortfolio(id),

      createPortfolio: ({ name, description }) => createPortfolio(name, description),

      updatePortfolio: ({ id, name, description }) => updatePortfolio(id, name, description),

      deletePortfolio: ({ id }) => deletePortfolio(id),

      // ── Holdings ────────────────────────────────────────────────────────
      listHoldings: ({ portfolioId }) => listHoldings(portfolioId),

      addHolding: ({ portfolioId, symbol, name, quantity, avgCostBasis }) =>
        addHolding(portfolioId, symbol, name, quantity, avgCostBasis),

      updateHolding: ({ id, quantity, avgCostBasis }) => updateHolding(id, quantity, avgCostBasis),

      deleteHolding: ({ id }) => deleteHolding(id),

      // ── Market data ─────────────────────────────────────────────────────
      searchAssets: ({ query }) => providers.search(query),

      getPrices: async ({ symbols }) => {
        const cachedMap = new Map<string, PriceData>();
        for (const sym of symbols) {
          const c = getLastCachedPrice(sym);
          if (c) {
            cachedMap.set(c.symbol, {
              symbol: c.symbol,
              provider: c.provider,
              price_usd: c.price_usd,
              change_24h: c.change_24h,
              change_7d: c.change_7d,
              volume_24h: c.volume_24h,
              market_cap: c.market_cap,
            });
          }
        }

        const allCached = symbols.every(s => cachedMap.has(s.toUpperCase()));

        if (allCached) {
          // Return cached data immediately and refresh in the background
          providers.getPrices(symbols)
            .then(fresh => { for (const p of fresh) upsertPriceCache(p); })
            .catch(err => console.warn("[prices] background refresh failed:", err));
          return Array.from(cachedMap.values());
        }

        // Some symbols have no cache — fetch all fresh and save
        const fresh = await providers.getPrices(symbols);
        for (const p of fresh) upsertPriceCache(p);
        return fresh;
      },

      // ── Analysis ────────────────────────────────────────────────────────
      analyzePortfolio: async ({ portfolioId }) => {
        const portfolio = getPortfolio(portfolioId);
        if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);
        return analyzePortfolio(portfolioId, portfolio.name);
      },

      getSignalExplanation: async ({ analysisId, signalIndex }) => {
        const record = getAnalysisById(analysisId);
        if (!record) throw new Error(`Analysis ${analysisId} not found`);
        const signal = record.signals[signalIndex];
        if (!signal) throw new Error(`Signal index ${signalIndex} out of range`);
        return explainSignal(analysisId, signalIndex, signal, record.portfolio_id);
      },

      listAnalysisResults: ({ portfolioId }) => listAnalysisResults(portfolioId),
    },
  },
});
