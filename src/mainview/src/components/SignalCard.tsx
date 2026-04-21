import { createSignal, Show } from "solid-js";
import type { Signal } from "../../../bun/db/types";
import { api } from "../ipc";

type Props = {
  signal: Signal;
  analysisId: number;
  signalIndex: number;
};

const SEVERITY_COLOR: Record<Signal["severity"], string> = {
  low: "var(--text-muted)",
  medium: "var(--warn)",
  high: "var(--loss)",
};

const SEVERITY_BADGE: Record<Signal["severity"], string> = {
  low: "badge-low",
  medium: "badge-medium",
  high: "badge-high",
};

export default function SignalCard(props: Props) {
  const [expanded, setExpanded] = createSignal(false);
  const [explanation, setExplanation] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  async function handleExplain() {
    if (explanation()) {
      setExpanded((v) => !v);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const text = await api.getSignalExplanation({
        analysisId: props.analysisId,
        signalIndex: props.signalIndex,
      });
      setExplanation(text);
    } catch (err) {
      setExplanation("Failed to load explanation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="signal-card" style={`border-left-color: ${SEVERITY_COLOR[props.signal.severity]}`}>
      <div class="signal-header">
        <div class="signal-left">
          <span class={`signal-badge ${SEVERITY_BADGE[props.signal.severity]}`}>
            {props.signal.severity}
          </span>
          <span class="signal-asset">{props.signal.asset}</span>
          <span class="signal-label">{props.signal.short_label}</span>
        </div>
        <button class="btn btn-ghost btn-sm" onClick={handleExplain}>
          {expanded() ? "Collapse" : "Explain"}
        </button>
      </div>

      <Show when={expanded()}>
        <div class="signal-explanation">
          <Show when={!loading()} fallback={<span class="muted">Asking Claude…</span>}>
            {explanation()}
          </Show>
        </div>
      </Show>
    </div>
  );
}
