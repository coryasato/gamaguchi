import { createSignal, For, Show } from "solid-js";
import type { Holding } from "../../../bun/db/types";
import { api } from "../ipc";

type Props = {
  holdings: Holding[];
  priceMap: Map<string, number>;
  onMutate: () => void;
};

type EditState = { id: number; quantity: string; avgCostBasis: string };

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

export default function HoldingsTable(props: Props) {
  const [editing, setEditing] = createSignal<EditState | null>(null);

  async function handleDelete(id: number) {
    if (!confirm("Remove this holding?")) return;
    await api.deleteHolding({ id });
    props.onMutate();
  }

  function startEdit(h: Holding) {
    setEditing({ id: h.id, quantity: String(h.quantity), avgCostBasis: String(h.avg_cost_basis) });
  }

  async function saveEdit() {
    const e = editing();
    if (!e) return;
    const quantity = parseFloat(e.quantity);
    const avgCostBasis = parseFloat(e.avgCostBasis);
    if (isNaN(quantity) || isNaN(avgCostBasis)) return;
    await api.updateHolding({ id: e.id, quantity, avgCostBasis });
    setEditing(null);
    props.onMutate();
  }

  return (
    <div class="table-wrap">
      <Show
        when={props.holdings.length > 0}
        fallback={<div class="table-empty">No holdings yet. Search for an asset below to add one.</div>}
      >
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th class="right">Quantity</th>
              <th class="right">Avg Cost</th>
              <th class="right">Price</th>
              <th class="right">Value</th>
              <th class="right">P&amp;L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <For each={props.holdings}>
              {(h) => {
                const price = () => props.priceMap.get(h.symbol);
                const value = () => price() != null ? h.quantity * price()! : null;
                const cost = () => h.quantity * h.avg_cost_basis;
                const pnl = () => value() != null ? value()! - cost() : null;
                const pnlPct = () => pnl() != null ? (pnl()! / cost()) * 100 : null;
                const isEditing = () => editing()?.id === h.id;

                return (
                  <tr>
                    <td>
                      <div class="symbol">{h.symbol}</div>
                      <div class="asset-name">{h.name}</div>
                    </td>
                    <td class="right">
                      <Show when={isEditing()} fallback={h.quantity}>
                        <div class="inline-edit">
                          <input
                            value={editing()!.quantity}
                            onInput={(e) => setEditing({ ...editing()!, quantity: e.currentTarget.value })}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          />
                        </div>
                      </Show>
                    </td>
                    <td class="right">
                      <Show when={isEditing()} fallback={`$${fmt(h.avg_cost_basis)}`}>
                        <div class="inline-edit">
                          <input
                            value={editing()!.avgCostBasis}
                            onInput={(e) => setEditing({ ...editing()!, avgCostBasis: e.currentTarget.value })}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          />
                        </div>
                      </Show>
                    </td>
                    <td class="right">
                      {price() != null ? `$${fmt(price()!)}` : <span class="muted">—</span>}
                    </td>
                    <td class="right">
                      {value() != null ? `$${fmt(value()!)}` : <span class="muted">—</span>}
                    </td>
                    <td class="right">
                      <Show when={pnl() != null} fallback={<span class="muted">—</span>}>
                        <span class={pnl()! >= 0 ? "gain" : "loss"}>
                          {pnl()! >= 0 ? "+" : ""}${fmt(Math.abs(pnl()!))}
                          <br />
                          <small>{fmtPct(pnlPct()!)}</small>
                        </span>
                      </Show>
                    </td>
                    <td>
                      <div class="row-actions">
                        <Show
                          when={isEditing()}
                          fallback={
                            <>
                              <button class="icon-btn" title="Edit" onClick={() => startEdit(h)}>✎</button>
                              <button class="icon-btn danger" title="Remove" onClick={() => handleDelete(h.id)}>✕</button>
                            </>
                          }
                        >
                          <button class="icon-btn" title="Save" onClick={saveEdit}>✓</button>
                          <button class="icon-btn" title="Cancel" onClick={() => setEditing(null)}>✕</button>
                        </Show>
                      </div>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
