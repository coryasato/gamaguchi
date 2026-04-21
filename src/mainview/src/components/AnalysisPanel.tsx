import { createSignal, For, Show } from "solid-js";
import type { AnalysisResultParsed } from "../../../bun/db/types";
import { api } from "../ipc";
import SignalCard from "./SignalCard";

type Props = {
  portfolioId: number;
};

export default function AnalysisPanel(props: Props) {
  const [result, setResult] = createSignal<AnalysisResultParsed | null>(null);
  const [analyzing, setAnalyzing] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await api.analyzePortfolio({ portfolioId: props.portfolioId });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div class="analysis-wrap">
      <div class="section-header">
        <span class="section-title">AI Analysis</span>
        <button
          class="btn btn-primary btn-sm"
          disabled={analyzing()}
          onClick={handleAnalyze}
        >
          {analyzing() ? "Analyzing…" : "Analyze Portfolio"}
        </button>
      </div>

      <Show when={error()}>
        <div class="analysis-error">{error()}</div>
      </Show>

      <Show when={result()}>
        {(res) => (
          <div class="analysis-result">
            <p class="analysis-summary">{res().summary}</p>
            <div class="signal-list">
              <For each={res().signals}>
                {(signal, i) => (
                  <SignalCard
                    signal={signal}
                    analysisId={res().id}
                    signalIndex={i()}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </Show>

      <Show when={!result() && !analyzing() && !error()}>
        <div class="analysis-empty">
          Run an analysis to get AI-powered signals on this portfolio.
        </div>
      </Show>
    </div>
  );
}
