import { Electroview } from "electrobun/view";
import type { AppSchema } from "../../shared/ipc-schema";

const view = new Electroview({
  rpc: Electroview.defineRPC<AppSchema>({ handlers: {} }),
});

/**
 * Typed proxy for calling main-process methods from SolidJS components.
 * Usage: await api.listPortfolios()
 *        await api.searchAssets({ query: "bitcoin" })
 */
export const api = view.rpc!.requestProxy;
