import type { Asset, PriceData, OHLCV, PriceProvider } from "./types";

const BASE = "https://api.kraken.com/0/public";

// Kraken uses "XBT" internally for Bitcoin; map to standard symbols
const KRAKEN_TO_STANDARD: Record<string, string> = {
  XXBT: "BTC",
  XETH: "ETH",
  XXRP: "XRP",
  XLTC: "LTC",
  XXLM: "XLM",
  XZEC: "ZEC",
};

function toKrakenPair(symbol: string): string {
  const s = symbol.toUpperCase();
  // Kraken pairs are typically SYMBOL/USD or XSYMBOL/ZUSD
  if (s === "BTC") return "XBTUSD";
  return `${s}USD`;
}

function toStandardSymbol(krakenSymbol: string): string {
  return KRAKEN_TO_STANDARD[krakenSymbol] ?? krakenSymbol.replace(/^X/, "").replace(/Z?USD$/, "");
}

export class KrakenProvider implements PriceProvider {
  readonly name = "kraken";

  private rateLimitedUntil = 0;

  isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  private async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());

    if (res.status === 429) {
      this.rateLimitedUntil = Date.now() + 60_000;
      throw new Error("Kraken rate limited");
    }

    if (!res.ok) throw new Error(`Kraken ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { error: string[]; result: T };
    if (json.error?.length) throw new Error(`Kraken API error: ${json.error.join(", ")}`);

    return json.result;
  }

  // Kraken doesn't have a search endpoint — return a best-guess asset from symbol
  async search(query: string): Promise<Asset[]> {
    const symbol = query.toUpperCase();
    return [{ symbol, name: symbol, id: toKrakenPair(symbol) }];
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    const pairs = symbols.map(toKrakenPair);
    const data = await this.fetch<
      Record<string, { c: [string, string]; v: [string, string]; p: [string, string] }>
    >("/Ticker", { pair: pairs.join(",") });

    return Object.entries(data).map(([pair, v]) => ({
      symbol: toStandardSymbol(pair),
      provider: this.name,
      price_usd: parseFloat(v.c[0]),
      change_24h: null, // Kraken ticker doesn't give % change directly
      change_7d: null,
      volume_24h: parseFloat(v.v[1]), // v[1] = 24h volume
      market_cap: null,
    }));
  }

  async getHistory(symbol: string, days: number): Promise<OHLCV[]> {
    const pair = toKrakenPair(symbol);
    // Kraken interval in minutes; pick appropriate resolution for requested days
    const interval = days <= 1 ? 60 : days <= 7 ? 240 : 1440;
    const since = Math.floor((Date.now() - days * 86_400_000) / 1000);

    const data = await this.fetch<Record<string, Array<[number, string, string, string, string, string, string, number]>>>(
      "/OHLC",
      { pair, interval: String(interval), since: String(since) },
    );

    // Result key is the pair name (may differ from input)
    const rows = Object.values(data)[0] ?? [];
    return rows.map(([time, open, high, low, close, , volume]) => ({
      timestamp: time * 1000,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
    }));
  }
}
