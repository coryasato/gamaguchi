import { createResource, createSignal, Show } from "solid-js";
import { api } from "./src/ipc";
import PortfolioList from "./src/components/PortfolioList";
import PortfolioDetail from "./src/components/PortfolioDetail";

export default function App() {
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [portfolios, { refetch }] = createResource(() => api.listPortfolios());

  const activeId = () => {
    const id = selectedId();
    if (id === null) return null;
    const list = portfolios();
    if (!list) return id;
    return list.some(p => p.id === id) ? id : null;
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
          when={activeId() !== null}
          fallback={
            <div class="empty-state">
              <p>Select a portfolio or create one to get started.</p>
            </div>
          }
        >
          <PortfolioDetail portfolioId={activeId()!} />
        </Show>
      </div>
    </div>
  );
}
