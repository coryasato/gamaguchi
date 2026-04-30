import { generateText } from "ai";
import { createXai } from "@ai-sdk/xai";
import type { Signal, AnalysisResultParsed } from "../db/types";
import type { PriceData } from "../providers/types";
import {
  SYSTEM_PROMPT,
  EXPLAIN_SYSTEM_PROMPT,
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

const MODEL = "grok-4.20-non-reasoning-latest";

let _xai: ReturnType<typeof createXai> | null = null;

function getClient(): ReturnType<typeof createXai> {
  if (_xai) return _xai;
  const apiKey = Bun.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not set in .env");
  _xai = createXai({ apiKey });
  return _xai;
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

  const { text } = await generateText({
    model: getClient()(MODEL),
    maxTokens: 1500,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  const parsed = parseAnalysisResponse(text);
  return saveAnalysisResult(portfolioId, MODEL, parsed.summary, parsed.signals);
}

export async function explainSignal(
  analysisId: number,
  signalIndex: number,
  signal: Signal,
  portfolioId: number,
): Promise<string> {
  const cached = getSignalDetail(analysisId, signalIndex);
  if (cached) return cached.explanation;

  const holdings = await listHoldings(portfolioId);
  const holding = holdings.find((h) => h.symbol === signal.asset) ?? null;

  let price: PriceData | null = null;
  if (holding) {
    const prices = await providers.getPrices([holding.symbol]);
    price = prices[0] ?? null;
  }

  const prompt = buildExplainPrompt(signal.short_label, signal.context, signal.action, holding, price);

  const { text } = await generateText({
    model: getClient()(MODEL),
    maxTokens: 1024,
    system: EXPLAIN_SYSTEM_PROMPT,
    prompt,
  });

  const explanation = text.trim();
  saveSignalDetail(analysisId, signalIndex, explanation);
  return explanation;
}

const VALID_ACTIONS = new Set(["watch", "reduce", "add", "exit", "hold"]);

function parseAnalysisResponse(raw: string): { summary: string; signals: Signal[] } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const data = JSON.parse(cleaned);
    if (typeof data.summary !== "string" || !Array.isArray(data.signals)) {
      throw new Error("Unexpected response shape");
    }
    const signals: Signal[] = data.signals.map((s: Record<string, unknown>) => ({
      severity: (["low", "medium", "high"].includes(s.severity as string) ? s.severity : "low") as Signal["severity"],
      action: (VALID_ACTIONS.has(s.action as string) ? s.action : "hold") as Signal["action"],
      asset: String(s.asset ?? ""),
      short_label: String(s.short_label ?? ""),
      context: String(s.context ?? ""),
    }));
    return { summary: data.summary, signals };
  } catch {
    return {
      summary: "Analysis complete.",
      signals: [{
        severity: "low",
        action: "watch",
        asset: "PORTFOLIO",
        short_label: "Raw analysis (parse error)",
        context: raw.slice(0, 500),
      }],
    };
  }
}
