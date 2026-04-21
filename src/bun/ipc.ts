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
} from "./db/queries";
import { providers } from "./providers/manager";

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
			// Implemented in Step 5 (feat/05-analysis)
			analyzePortfolio: () => {
				throw new Error("Analysis not yet implemented");
			},

			getSignalExplanation: () => {
				throw new Error("Signal explanation not yet implemented");
			},

			listAnalysisResults: ({ portfolioId }) => listAnalysisResults(portfolioId),
		},
	},
});
