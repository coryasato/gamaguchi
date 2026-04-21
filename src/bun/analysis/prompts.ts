import type { Holding } from "../db/types";
import type { PriceData } from "../providers/types";

export type PortfolioContext = {
  portfolioName: string;
  holdings: Holding[];
  prices: PriceData[];
};

function formatHoldings(ctx: PortfolioContext): string {
  return ctx.holdings.map((h) => {
    const price = ctx.prices.find((p) => p.symbol === h.symbol);
    const currentValue = price ? h.quantity * price.price_usd : null;
    const costBasis = h.quantity * h.avg_cost_basis;
    const pnl = currentValue != null ? currentValue - costBasis : null;
    const pnlPct = pnl != null ? (pnl / costBasis) * 100 : null;

    return [
      `- ${h.symbol} (${h.name})`,
      `  Quantity: ${h.quantity}`,
      `  Avg cost basis: $${h.avg_cost_basis.toFixed(2)}`,
      price
        ? [
            `  Current price: $${price.price_usd.toFixed(2)}`,
            price.change_24h != null ? `  24h change: ${price.change_24h.toFixed(2)}%` : null,
            price.change_7d != null ? `  7d change: ${price.change_7d.toFixed(2)}%` : null,
            price.volume_24h != null ? `  24h volume: $${(price.volume_24h / 1e6).toFixed(1)}M` : null,
            price.market_cap != null ? `  Market cap: $${(price.market_cap / 1e9).toFixed(2)}B` : null,
            currentValue != null ? `  Current value: $${currentValue.toFixed(2)}` : null,
            pnl != null
              ? `  P&L: ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct!.toFixed(2)}%)`
              : null,
          ].filter(Boolean).join("\n")
        : "  Price data unavailable",
    ].join("\n");
  }).join("\n\n");
}

export const SYSTEM_PROMPT = `You are a concise crypto portfolio analyst. You assess holdings and market data to surface actionable signals — potential gains, risks, and notable market conditions. You are direct, data-driven, and avoid generic advice.

Output format rules:
- summary: 1–2 sentences on the overall portfolio state
- signals: array of 1–5 most notable signals, each with:
  - severity: "low" | "medium" | "high"
  - asset: the ticker symbol (or "PORTFOLIO" for portfolio-level observations)
  - short_label: ≤12 words describing the signal
  - context: 2–4 sentences of supporting data and reasoning, suitable for lazy expansion

Respond ONLY with valid JSON matching this schema:
{
  "summary": string,
  "signals": [{ "severity": string, "asset": string, "short_label": string, "context": string }]
}`;

export function buildAnalysisPrompt(ctx: PortfolioContext): string {
  return `Portfolio: ${ctx.portfolioName}
Date: ${new Date().toISOString().split("T")[0]}

Holdings:
${formatHoldings(ctx)}

Analyze this portfolio and return your assessment as JSON.`;
}

export function buildExplainPrompt(
  shortLabel: string,
  context: string,
  holding: Holding | null,
  price: PriceData | null,
): string {
  const lines = [
    `Signal: "${shortLabel}"`,
    `Context: ${context}`,
  ];

  if (holding && price) {
    lines.push(
      `\nCurrent data for ${holding.symbol}:`,
      `  Price: $${price.price_usd.toFixed(2)}`,
      price.change_24h != null ? `  24h: ${price.change_24h.toFixed(2)}%` : "",
      price.change_7d != null ? `  7d: ${price.change_7d.toFixed(2)}%` : "",
      `  Holdings: ${holding.quantity} @ avg $${holding.avg_cost_basis.toFixed(2)}`,
    );
  }

  lines.push(
    "\nProvide a clear, plain-English explanation of this signal in 3–5 sentences. Cover what the data shows, why it matters for this position, and what to watch for. No bullet points, no headers.",
  );

  return lines.filter(Boolean).join("\n");
}
