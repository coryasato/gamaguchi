import { createResource, createSignal, Show } from "solid-js";
import { api } from "./src/ipc";
import PortfolioList from "./src/components/PortfolioList";
import PortfolioDetail from "./src/components/PortfolioDetail";

export default function App() {
  const [selectedId, setSelectedId] = createSignal<number | null>(null);
  const [portfolios, { refetch }] = createResource(() => api.listPortfolios());

  return (
    <div id="app">
      <PortfolioList
        portfolios={portfolios() ?? []}
        selectedId={selectedId()}
        onSelect={setSelectedId}
        onMutate={refetch}
      />
      <div class="main">
        <Show
          when={selectedId() !== null}
          fallback={
            <div class="empty-state">
              <p>Select a portfolio or create one to get started.</p>
            </div>
          }
        >
          <PortfolioDetail portfolioId={selectedId()!} />
        </Show>
      </div>
    </div>
  );
}
