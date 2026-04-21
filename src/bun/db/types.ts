export type Portfolio = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

export type Holding = {
  id: number;
  portfolio_id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost_basis: number;
  added_at: string;
};

export type PriceCache = {
  symbol: string;
  provider: string;
  price_usd: number;
  change_24h: number | null;
  change_7d: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  fetched_at: string;
};

export type Signal = {
  severity: "low" | "medium" | "high";
  asset: string;
  short_label: string;
  context: string;
};

export type AnalysisResult = {
  id: number;
  portfolio_id: number;
  model: string;
  summary: string;
  signals_json: string;
  created_at: string;
};

export type SignalDetail = {
  id: number;
  analysis_id: number;
  signal_index: number;
  explanation: string;
  created_at: string;
};

// Parsed form of AnalysisResult with signals decoded
export type AnalysisResultParsed = Omit<AnalysisResult, "signals_json"> & {
  signals: Signal[];
};
