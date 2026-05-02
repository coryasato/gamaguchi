import { createSignal, For, Show } from "solid-js";
import type { Portfolio } from "../../../bun/db/types";
import { api } from "../ipc";

type Props = {
  portfolios: Portfolio[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onMutate: () => void;
};

export default function PortfolioList(props: Props) {
  const [creating, setCreating] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newDesc, setNewDesc] = createSignal("");
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<number | null>(null);

  async function handleCreate() {
    const name = newName().trim();
    if (!name) return;
    const portfolio = await api.createPortfolio({ name, description: newDesc().trim() });
    setNewName("");
    setNewDesc("");
    setCreating(false);
    props.onMutate();
    props.onSelect(portfolio.id);
  }

  function requestDelete(id: number, e: MouseEvent) {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  async function confirmDelete(e: MouseEvent) {
    e.stopPropagation();
    const id = confirmDeleteId();
    if (id === null) return;
    setConfirmDeleteId(null);
    await api.deletePortfolio({ id });
    props.onMutate();
  }

  function cancelDelete(e: MouseEvent) {
    e.stopPropagation();
    setConfirmDeleteId(null);
  }

  return (
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>Gamaguchi</h1>
        <button class="icon-btn" title="New portfolio" onClick={() => setCreating(true)}>＋</button>
      </div>

      <div class="sidebar-list">
        <For each={props.portfolios}>
          {(p) => (
            <div
              class={`portfolio-item${props.selectedId === p.id ? " active" : ""}`}
              onClick={() => { setConfirmDeleteId(null); props.onSelect(p.id); }}
            >
              <span class="portfolio-item-name">{p.name}</span>
              <Show
                when={confirmDeleteId() === p.id}
                fallback={
                  <div class="portfolio-item-actions">
                    <button class="icon-btn danger" title="Delete" onClick={(e) => requestDelete(p.id, e)}>✕</button>
                  </div>
                }
              >
                <div class="portfolio-item-confirm">
                  <button class="icon-btn danger" onClick={confirmDelete}>Delete</button>
                  <button class="icon-btn" onClick={cancelDelete}>Cancel</button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={creating()}>
        <div class="sidebar-create">
          <div class="create-form">
            <input
              placeholder="Portfolio name"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autofocus
            />
            <input
              placeholder="Description (optional)"
              value={newDesc()}
              onInput={(e) => setNewDesc(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <div class="create-form-actions">
              <button class="btn btn-primary btn-sm" onClick={handleCreate}>Create</button>
              <button class="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
