import { createSignal, For, Show } from "solid-js";
import type { Asset } from "../../../bun/providers/types";
import { api } from "../ipc";

type Props = {
  portfolioId: number;
  onAdded: () => void;
};

export default function AssetSearch(props: Props) {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<Asset[]>([]);
  const [selected, setSelected] = createSignal<Asset | null>(null);
  const [quantity, setQuantity] = createSignal("");
  const [costBasis, setCostBasis] = createSignal("");
  const [searching, setSearching] = createSignal(false);
  const [adding, setAdding] = createSignal(false);

  let debounceTimer: ReturnType<typeof setTimeout>;

  async function handleInput(value: string) {
    setQuery(value);
    setSelected(null);
    clearTimeout(debounceTimer);
    if (!value.trim()) { setResults([]); return; }
    debounceTimer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchAssets({ query: value.trim() });
        setResults(res);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function selectAsset(asset: Asset) {
    setSelected(asset);
    setResults([]);
    setQuery(`${asset.symbol} — ${asset.name}`);
  }

  async function handleAdd() {
    const asset = selected();
    if (!asset) return;
    const qty = parseFloat(quantity());
    const cost = parseFloat(costBasis());
    if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) return;
    setAdding(true);
    try {
      await api.addHolding({
        portfolioId: props.portfolioId,
        symbol: asset.symbol,
        name: asset.name,
        quantity: qty,
        avgCostBasis: cost,
      });
      setQuery("");
      setQuantity("");
      setCostBasis("");
      setSelected(null);
      setResults([]);
      props.onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div class="search-wrap">
      <div class="search-input-row">
        <span class="muted" style="font-size:16px">⌕</span>
        <input
          placeholder="Search for a crypto asset..."
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
        />
        <Show when={searching()}>
          <span class="muted" style="font-size:11px">Searching…</span>
        </Show>
      </div>

      <Show when={results().length > 0}>
        <div class="search-results">
          <For each={results()}>
            {(asset) => (
              <div
                class={`search-result${selected()?.id === asset.id ? " selected" : ""}`}
                onClick={() => selectAsset(asset)}
              >
                <div>
                  <span class="symbol">{asset.symbol}</span>
                  <span class="asset-name" style="margin-left:8px">{asset.name}</span>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={selected()}>
        {(asset) => (
          <div class="add-form">
            <div class="add-form-title">Add {asset().symbol} to portfolio</div>
            <div class="add-form-fields">
              <div class="field">
                <label>Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={quantity()}
                  onInput={(e) => setQuantity(e.currentTarget.value)}
                />
              </div>
              <div class="field">
                <label>Avg Cost (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={costBasis()}
                  onInput={(e) => setCostBasis(e.currentTarget.value)}
                />
              </div>
            </div>
            <div class="add-form-actions">
              <button class="btn btn-primary btn-sm" disabled={adding()} onClick={handleAdd}>
                {adding() ? "Adding…" : "Add Holding"}
              </button>
              <button class="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setQuery(""); setResults([]); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
