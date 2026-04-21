import { BrowserView } from "electrobun/bun";
import type { AppSchema } from "../shared/ipc-schema";
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
} from "./db/queries";
import { providers } from "./providers/manager";
import { analyzePortfolio, explainSignal } from "./analysis/claude";

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

      getPrices: ({ symbols }) => providers.getPrices(symbols),

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
