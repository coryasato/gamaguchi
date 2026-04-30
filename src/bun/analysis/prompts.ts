import type { Holding } from "../db/types";
import type { Signal } from "../db/types";
import type { PriceData } from "../providers/types";

export type PortfolioContext = {
  portfolioName: string;
  holdings: Holding[];
  prices: PriceData[];
};

function formatHoldings(ctx: PortfolioContext): string {
  const rows = ctx.holdings.map((h) => {
    const price = ctx.prices.find((p) => p.symbol === h.symbol);
    const currentValue = price ? h.quantity * price.price_usd : null;
    const costBasis = h.quantity * h.avg_cost_basis;
    const pnl = currentValue != null ? currentValue - costBasis : null;
    const pnlPct = pnl != null ? (pnl / costBasis) * 100 : null;
    const holdingDays = Math.floor((Date.now() - new Date(h.added_at).getTime()) / 86400000);
    return { h, price, currentValue, costBasis, pnl, pnlPct, holdingDays };
  });

  const totalValue = rows.reduce((s, r) => s + (r.currentValue ?? 0), 0);

  return rows.map(({ h, price, currentValue, pnl, pnlPct, holdingDays }) => {
    const weight = totalValue > 0 && currentValue != null ? (currentValue / totalValue) * 100 : null;
    return [
      `- ${h.symbol} (${h.name})`,
      `  Quantity: ${h.quantity}`,
      `  Avg cost basis: $${h.avg_cost_basis.toFixed(2)}`,
      `  Holding period: ${holdingDays} days`,
      price
        ? [
            `  Current price: $${price.price_usd.toFixed(2)}`,
            price.change_24h != null ? `  24h change: ${price.change_24h.toFixed(2)}%` : null,
            price.change_7d != null ? `  7d change: ${price.change_7d.toFixed(2)}%` : null,
            price.volume_24h != null ? `  24h volume: $${(price.volume_24h / 1e6).toFixed(1)}M` : null,
            price.market_cap != null ? `  Market cap: $${(price.market_cap / 1e9).toFixed(2)}B` : null,
            currentValue != null ? `  Current value: $${currentValue.toFixed(2)}` : null,
            weight != null ? `  Portfolio weight: ${weight.toFixed(1)}%` : null,
            pnl != null
              ? `  P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct!.toFixed(2)}%)`
              : null,
          ].filter(Boolean).join("\n")
        : "  Price data unavailable",
    ].join("\n");
  }).join("\n\n");
}

export const SYSTEM_PROMPT = `You are a crypto portfolio analyst. Your job is to surface specific, data-grounded signals that a trader can act on today.

Rules you must follow:
- Every signal MUST reference at least one concrete number from the data (a price, a percentage, a dollar amount, a portfolio weight, or a holding period in days).
- "context" must mention specific figures — never write "significant move" when you can write "+34% in 7 days". Never write "large position" when you can write "38% of portfolio".
- Do not give advice that would apply to any portfolio (e.g. "consider diversification", "crypto is volatile"). If a signal would be true for a portfolio you haven't seen, discard it.
- short_label must be ≤12 words and contain at least one number or ticker-specific term.
- Prioritize signals where the data is anomalous: a holding with P&L diverging sharply from peers, concentration exceeding 40% of total portfolio value, 7d momentum divergence between holdings, or a cost basis dangerously close to current price (< 10% drawdown cushion).
- action meanings: "add" = conditions favor increasing position; "reduce" = trim exposure given risk/gain; "exit" = warrants full close; "watch" = notable but no trade yet; "hold" = no change.

Output format: respond ONLY with valid JSON matching this schema:
{
  "summary": string,
  "signals": [{
    "severity": "low" | "medium" | "high",
    "action": "watch" | "reduce" | "add" | "exit" | "hold",
    "asset": string,
    "short_label": string,
    "context": string
  }]
}

summary: 1–2 sentences. Must include: total portfolio value, total P&L%, and the single most important condition right now.
signals: 1–5 entries, ordered by severity descending. context is 2–4 sentences — include exact prices, weights, and P&L figures from the data provided.`;

export const EXPLAIN_SYSTEM_PROMPT = `You are a concise crypto trading analyst explaining a specific signal to a portfolio holder.

Rules:
- Write exactly 3–5 sentences. No bullet points, no headers, no numbered lists.
- Sentence 1: state what the data shows with specific numbers (price, P&L%, weight, or holding period).
- Sentence 2: explain why this matters for this specific position (reference cost basis or portfolio context).
- Sentence 3–4: name a concrete level or condition to watch — a price threshold, a percentage move, or a time window.
- Final sentence: state the action implication clearly ("if X happens, consider Y").
- Do not use phrases like "it's important to note", "keep in mind", or "as always in crypto".`;

export function buildAnalysisPrompt(ctx: PortfolioContext): string {
  const rows = ctx.holdings.map((h) => {
    const price = ctx.prices.find((p) => p.symbol === h.symbol);
    const currentValue = price ? h.quantity * price.price_usd : null;
    const costBasis = h.quantity * h.avg_cost_basis;
    return { currentValue, costBasis };
  });
  const totalValue = rows.reduce((s, r) => s + (r.currentValue ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + r.costBasis, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return [
    `Portfolio: ${ctx.portfolioName}`,
    `Date: ${new Date().toISOString().split("T")[0]}`,
    ``,
    `PORTFOLIO TOTALS`,
    `  Total value:      $${totalValue.toFixed(2)}`,
    `  Total cost basis: $${totalCost.toFixed(2)}`,
    `  Total P&L:        ${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)} (${totalPnlPct.toFixed(2)}%)`,
    `  Number of assets: ${ctx.holdings.length}`,
    ``,
    `HOLDINGS (each includes portfolio weight %)`,
    formatHoldings(ctx),
    ``,
    `Analyze this portfolio. Every signal must cite specific numbers from the data above.`,
  ].join("\n");
}

export function buildExplainPrompt(
  shortLabel: string,
  context: string,
  action: Signal["action"],
  holding: Holding | null,
  price: PriceData | null,
): string {
  const lines = [
    `Signal: "${shortLabel}"`,
    `Recommended action: ${action}`,
    `Context: ${context}`,
  ];

  if (holding && price) {
    const costBasis = holding.quantity * holding.avg_cost_basis;
    const currentValue = holding.quantity * price.price_usd;
    const pnl = currentValue - costBasis;
    const pnlPct = (pnl / costBasis) * 100;
    const holdingDays = Math.floor((Date.now() - new Date(holding.added_at).getTime()) / 86400000);

    lines.push(
      ``,
      `Current data for ${holding.symbol}:`,
      `  Price: $${price.price_usd.toFixed(2)}`,
      price.change_24h != null ? `  24h: ${price.change_24h.toFixed(2)}%` : "",
      price.change_7d != null ? `  7d: ${price.change_7d.toFixed(2)}%` : "",
      `  Holdings: ${holding.quantity} @ avg $${holding.avg_cost_basis.toFixed(2)}`,
      `  Current value: $${currentValue.toFixed(2)}`,
      `  P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
      `  Held for: ${holdingDays} days`,
    );
  }

  lines.push(
    ``,
    `Explain this signal in 3–5 sentences. Reference the specific numbers above. End with what to watch for and what action to take if that condition is met.`,
  );

  return lines.filter(Boolean).join("\n");
}
