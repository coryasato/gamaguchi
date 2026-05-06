import { createResource, createSignal, Show } from "solid-js";
import { api } from "./src/ipc";
import PortfolioList from "./src/components/PortfolioList";
import PortfolioDetail from "./src/components/PortfolioDetail";

export default function App() {
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [portfolios, { refetch }] = createResource(() => api.listPortfolios());

  const activeId = () => {
    const list = portfolios();
    if (!list) return null;

    const id = selectedId();
    if (id !== null && list.some(p => p.id === id)) return id;

    return list[0]?.id ?? null;
  };

  return (
    <div id="app">
      <PortfolioList
        portfolios={portfolios() ?? []}
        selectedId={activeId()}
        onSelect={setSelectedId}
        onMutate={refetch}
      />
      <div class="main">
        <Show
          when={activeId()}
          keyed
          fallback={
            <div class="empty-state">
              <p>Select a portfolio or create one to get started.</p>
            </div>
          }
        >
          {(id) => <PortfolioDetail portfolioId={id} />}
        </Show>
      </div>
    </div>
  );
}
