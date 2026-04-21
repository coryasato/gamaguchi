import { Electroview } from "electrobun/view";
import type { AppSchema } from "../../shared/ipc-schema";

const view = new Electroview({
  rpc: Electroview.defineRPC<AppSchema>({ handlers: {} }),
});

/**
 * Typed proxy for calling bun-side methods from SolidJS components.
 * Usage: await bun.listPortfolios()
 *        await bun.searchAssets({ query: "bitcoin" })
 */
export const bun = view.rpc!.requestProxy;
