import { CoinGeckoProvider } from "./coingecko";
import { KrakenProvider } from "./kraken";
import type { Asset, PriceData, OHLCV, PriceProvider } from "./types";

export class ProviderManager {
  private providers: PriceProvider[];

  constructor(providers: PriceProvider[]) {
    this.providers = providers;
  }

  private available(): PriceProvider[] {
    return this.providers.filter((p) => !p.isRateLimited());
  }

  // Run op against providers in order, falling back on rate limit or error
  private async withFallback<T>(op: (p: PriceProvider) => Promise<T>): Promise<T> {
    const candidates = this.available();
    if (candidates.length === 0) throw new Error("All providers are rate limited");

    let lastError: unknown;
    for (const provider of candidates) {
      try {
        return await op(provider);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[providers] ${provider.name} failed: ${msg}`);
      }
    }
    throw lastError;
  }

  async search(query: string): Promise<Asset[]> {
    return this.withFallback((p) => p.search(query));
  }

  async getPrices(symbols: string[]): Promise<PriceData[]> {
    return this.withFallback((p) => p.getPrices(symbols));
  }

  async getHistory(symbol: string, days: number): Promise<OHLCV[]> {
    return this.withFallback((p) => p.getHistory(symbol, days));
  }
}

// Singleton — CoinGecko primary, Kraken fallback
export const providers = new ProviderManager([
  new CoinGeckoProvider(),
  new KrakenProvider(),
]);
