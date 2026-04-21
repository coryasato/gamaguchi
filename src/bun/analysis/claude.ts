import Anthropic from "@anthropic-ai/sdk";
import type { Signal, AnalysisResultParsed } from "../db/types";
import type { PriceData } from "../providers/types";
import {
  SYSTEM_PROMPT,
  buildAnalysisPrompt,
  buildExplainPrompt,
  type PortfolioContext,
} from "./prompts";
import {
  listHoldings,
  saveAnalysisResult,
  getSignalDetail,
  saveSignalDetail,
} from "../db/queries";
import { providers } from "../providers/manager";

const MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in .env");
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function analyzePortfolio(
  portfolioId: number,
  portfolioName: string,
): Promise<AnalysisResultParsed> {
  const holdings = await listHoldings(portfolioId);
  if (holdings.length === 0) throw new Error("No holdings to analyze");

  const symbols = [...new Set(holdings.map((h) => h.symbol))];
  const prices = await providers.getPrices(symbols);

  const ctx: PortfolioContext = { portfolioName, holdings, prices };
  const userPrompt = buildAnalysisPrompt(ctx);

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = message.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = parseAnalysisResponse(raw);

  return saveAnalysisResult(portfolioId, MODEL, parsed.summary, parsed.signals);
}

export async function explainSignal(
  analysisId: number,
  signalIndex: number,
  signal: Signal,
  portfolioId: number,
): Promise<string> {
  // Return cached explanation if available
  const cached = getSignalDetail(analysisId, signalIndex);
  if (cached) return cached.explanation;

  const holdings = await listHoldings(portfolioId);
  const holding = holdings.find((h) => h.symbol === signal.asset) ?? null;

  let price: PriceData | null = null;
  if (holding) {
    const prices = await providers.getPrices([holding.symbol]);
    price = prices[0] ?? null;
  }

  const prompt = buildExplainPrompt(signal.short_label, signal.context, holding, price);

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const explanation = message.content.find((b) => b.type === "text")?.text?.trim() ?? "";
  saveSignalDetail(analysisId, signalIndex, explanation);
  return explanation;
}

function parseAnalysisResponse(raw: string): { summary: string; signals: Signal[] } {
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const data = JSON.parse(cleaned);
    if (typeof data.summary !== "string" || !Array.isArray(data.signals)) {
      throw new Error("Unexpected response shape");
    }
    const signals: Signal[] = data.signals.map((s: Record<string, unknown>) => ({
      severity: (["low", "medium", "high"].includes(s.severity as string) ? s.severity : "low") as Signal["severity"],
      asset: String(s.asset ?? ""),
      short_label: String(s.short_label ?? ""),
      context: String(s.context ?? ""),
    }));
    return { summary: data.summary, signals };
  } catch {
    // Graceful fallback — surface the raw text as a single signal
    return {
      summary: "Analysis complete.",
      signals: [{
        severity: "low",
        asset: "PORTFOLIO",
        short_label: "Raw analysis (parse error)",
        context: raw.slice(0, 500),
      }],
    };
  }
}
