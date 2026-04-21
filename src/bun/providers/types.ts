export type Asset = {
  symbol: string;
  name: string;
  id: string; // provider-specific id (e.g. "bitcoin" for CoinGecko)
};

export type PriceData = {
  symbol: string;
  provider: string;
  price_usd: number;
  change_24h: number | null;
  change_7d: number | null;
  volume_24h: number | null;
  market_cap: number | null;
};

export type OHLCV = {
  timestamp: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface PriceProvider {
  readonly name: string;
  search(query: string): Promise<Asset[]>;
  getPrices(symbols: string[]): Promise<PriceData[]>;
  getHistory(symbol: string, days: number): Promise<OHLCV[]>;
  isRateLimited(): boolean;
}
