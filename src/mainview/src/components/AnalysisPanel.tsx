type Props = {
  portfolioId: number;
};

export default function AnalysisPanel(_props: Props) {
  return (
    <div class="analysis-panel">
      <div>
        <div class="section-title">AI Analysis</div>
        <p>Claude-powered signals coming in Step 5.</p>
      </div>
      <button class="btn btn-primary" disabled>Analyze Portfolio</button>
    </div>
  );
}
