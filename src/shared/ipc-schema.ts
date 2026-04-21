import type { Portfolio, Holding, AnalysisResultParsed } from "../bun/db/types";
import type { Asset, PriceData } from "../bun/providers/types";

/**
 * Typed contract between the Bun main process and the SolidJS renderer.
 * All API keys and DB access live exclusively on the bun side.
 */
export type AppSchema = {
	bun: {
		requests: {
			// ── Portfolios ────────────────────────────────────────────────────
			listPortfolios:       { params: undefined;                                                                            response: Portfolio[] };
			getPortfolio:         { params: { id: number };                                                                       response: Portfolio | null };
			createPortfolio:      { params: { name: string; description: string };                                                response: Portfolio };
			updatePortfolio:      { params: { id: number; name: string; description: string };                                    response: void };
			deletePortfolio:      { params: { id: number };                                                                       response: void };
			// ── Holdings ──────────────────────────────────────────────────────
			listHoldings:         { params: { portfolioId: number };                                                              response: Holding[] };
			addHolding:           { params: { portfolioId: number; symbol: string; name: string; quantity: number; avgCostBasis: number }; response: Holding };
			updateHolding:        { params: { id: number; quantity: number; avgCostBasis: number };                               response: void };
			deleteHolding:        { params: { id: number };                                                                       response: void };
			// ── Market data ───────────────────────────────────────────────────
			searchAssets:         { params: { query: string };                                                                    response: Asset[] };
			getPrices:            { params: { symbols: string[] };                                                                response: PriceData[] };
			// ── Analysis ──────────────────────────────────────────────────────
			analyzePortfolio:     { params: { portfolioId: number };                                                              response: AnalysisResultParsed };
			getSignalExplanation: { params: { analysisId: number; signalIndex: number };                                          response: string };
			listAnalysisResults:  { params: { portfolioId: number };                                                              response: AnalysisResultParsed[] };
		};
		messages: Record<never, never>;
	};
	webview: {
		requests: Record<never, never>;
		messages: Record<never, never>;
	};
};
