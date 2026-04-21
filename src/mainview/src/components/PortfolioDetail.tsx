import { createResource, createMemo, Show } from "solid-js";
import { api } from "../ipc";
import HoldingsTable from "./HoldingsTable";
import AssetSearch from "./AssetSearch";
import AnalysisPanel from "./AnalysisPanel";

type Props = {
  portfolioId: number;
};

export default function PortfolioDetail(props: Props) {
  const [portfolio] = createResource(() => props.portfolioId, (id) =>
    api.getPortfolio({ id })
  );

  const [holdings, { refetch: refetchHoldings }] = createResource(
    () => props.portfolioId,
    (id) => api.listHoldings({ portfolioId: id })
  );

  const symbols = createMemo(() =>
    [...new Set((holdings() ?? []).map((h) => h.symbol))]
  );

  const [prices] = createResource(symbols, (syms) =>
    syms.length > 0 ? api.getPrices({ symbols: syms }) : Promise.resolve([])
  );

  const priceMap = createMemo(() => {
    const map = new Map<string, number>();
    for (const p of prices() ?? []) map.set(p.symbol, p.price_usd);
    return map;
  });

  return (
    <>
      <div class="main-header">
        <Show when={portfolio()}>
          {(p) => (
            <div>
              <h2>{p().name}</h2>
              <Show when={p().description}>
                <p>{p().description}</p>
              </Show>
            </div>
          )}
        </Show>
      </div>

      <div class="main-body">
        <div>
          <div class="section-header">
            <span class="section-title">Holdings</span>
          </div>
          <HoldingsTable
            holdings={holdings() ?? []}
            priceMap={priceMap()}
            onMutate={refetchHoldings}
          />
        </div>

        <div>
          <div class="section-header">
            <span class="section-title">Add Asset</span>
          </div>
          <AssetSearch
            portfolioId={props.portfolioId}
            onAdded={refetchHoldings}
          />
        </div>

        <AnalysisPanel portfolioId={props.portfolioId} />
      </div>
    </>
  );
}
