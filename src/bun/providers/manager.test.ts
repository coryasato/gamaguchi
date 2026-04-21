import { describe, test, expect } from "bun:test";
import { ProviderManager } from "./manager.test-exports";
import type { PriceProvider } from "./types";

function makeProvider(name: string, rateLimited = false): PriceProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name,
    calls,
    isRateLimited: () => rateLimited,
    search: async (_q) => { calls.push("search"); return [{ symbol: "BTC", name: "Bitcoin", id: "bitcoin" }]; },
    getPrices: async (_s) => { calls.push("getPrices"); return [{ symbol: "BTC", provider: name, price_usd: 50000, change_24h: 1.5, change_7d: null, volume_24h: null, market_cap: null }]; },
    getHistory: async (_s, _d) => { calls.push("getHistory"); return []; },
  };
}

describe("ProviderManager", () => {
  test("uses primary provider when available", async () => {
    const primary = makeProvider("primary");
    const secondary = makeProvider("secondary");
    const mgr = new ProviderManager([primary, secondary]);

    await mgr.search("bitcoin");
    expect(primary.calls).toEqual(["search"]);
    expect(secondary.calls).toEqual([]);
  });

  test("falls back to secondary when primary is rate limited", async () => {
    const primary = makeProvider("primary", true);
    const secondary = makeProvider("secondary");
    const mgr = new ProviderManager([primary, secondary]);

    const results = await mgr.getPrices(["BTC"]);
    expect(results[0].provider).toBe("secondary");
    expect(primary.calls).toEqual([]);
    expect(secondary.calls).toEqual(["getPrices"]);
  });

  test("falls back to secondary when primary throws", async () => {
    const primary: PriceProvider & { calls: string[] } = {
      ...makeProvider("primary"),
      getPrices: async () => { throw new Error("network error"); },
    };
    (primary as any).calls = [];
    const secondary = makeProvider("secondary");
    const mgr = new ProviderManager([primary, secondary]);

    const results = await mgr.getPrices(["BTC"]);
    expect(results[0].provider).toBe("secondary");
  });

  test("throws when all providers are rate limited", async () => {
    const mgr = new ProviderManager([
      makeProvider("p1", true),
      makeProvider("p2", true),
    ]);
    expect(mgr.search("btc")).rejects.toThrow("All providers are rate limited");
  });

  test("throws when all providers fail", async () => {
    const failing: PriceProvider = {
      name: "failing",
      isRateLimited: () => false,
      search: async () => { throw new Error("boom"); },
      getPrices: async () => { throw new Error("boom"); },
      getHistory: async () => { throw new Error("boom"); },
    };
    const mgr = new ProviderManager([failing]);
    expect(mgr.search("btc")).rejects.toThrow("boom");
  });
});
