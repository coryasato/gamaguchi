import type { Asset, PriceData, OHLCV, PriceProvider } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
// Symbol → CoinGecko id mapping cache (populated via search)
const symbolToId = new Map<string, string>();

export class CoinGeckoProvider implements PriceProvider {
  readonly name = "coingecko";

  private rateLimitedUntil = 0;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY;
  }

  isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  private headers(): Record<string, string> {
    return this.apiKey ? { "x-cg-demo-api-key": this.apiKey } : {};
  }

  private async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), { headers: this.headers() });

    if (res.status === 429) {
      // Back off for 60 seconds
      this.rateLimitedUntil = Date.now() + 60_000;
      throw new Error("CoinGecko rate limited");
    }

    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${await res.text()}`);

    return res.json() as Promise<T>;
  }

  async search(query: string): Promise<Asset[]> {
    const data = await this.fetch<{ coins: Array<{ id: string; symbol: string; name: string }> }>(
      "/search",
      { query },
    );

    return data.coins.slice(0, 20).map((c) => {
      const symbol = c.symbol.toUpperCase();
      symbolToId.set(symbol, c.id);
      return { symbol, name: c.name, id: c.id };
    });
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    const ids = symbols.map((s) => symbolToId.get(s.toUpperCase())).filter(Boolean) as string[];
    if (ids.length === 0) return [];

    const data = await this.fetch<
      Record<string, { usd: number; usd_24h_change: number; usd_7d_change: number; usd_24h_vol: number; usd_market_cap: number }>
    >("/simple/price", {
      ids: ids.join(","),
      vs_currencies: "usd",
      include_24hr_change: "true",
      include_7d_change: "true",
      include_24hr_vol: "true",
      include_market_cap: "true",
    });

    return Object.entries(data).map(([id, v]) => {
      const symbol = [...symbolToId.entries()].find(([, sid]) => sid === id)?.[0] ?? id.toUpperCase();
      return {
        symbol,
        provider: this.name,
        price_usd: v.usd,
        change_24h: v.usd_24h_change ?? null,
        change_7d: v.usd_7d_change ?? null,
        volume_24h: v.usd_24h_vol ?? null,
        market_cap: v.usd_market_cap ?? null,
      };
    });
  }

  async getHistory(symbol: string, days: number): Promise<OHLCV[]> {
    const id = symbolToId.get(symbol.toUpperCase());
    if (!id) throw new Error(`Unknown symbol for CoinGecko: ${symbol}. Search first.`);

    // CoinGecko OHLC endpoint returns [timestamp, open, high, low, close]
    const data = await this.fetch<Array<[number, number, number, number, number]>>(
      `/coins/${id}/ohlc`,
      { vs_currency: "usd", days: String(days) },
    );

    // Volume not available from OHLC endpoint; use market_chart for volume if needed
    return data.map(([timestamp, open, high, low, close]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume: 0,
    }));
  }
}
