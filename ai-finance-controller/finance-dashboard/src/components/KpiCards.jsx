function formatINR(n) {
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  
  function KpiCard({ label, value, accent }) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-1">
        <span className="text-text-dim text-xs uppercase tracking-wide">{label}</span>
        <span className={`text-3xl font-semibold ${accent ? "text-gold" : "text-text"}`}>
          {value}
        </span>
      </div>
    );
  }
  
  export default function KpiCards({ state }) {
    if (!state) return null;
  
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Records Processed" value={state.records_processed} />
        <KpiCard
          label="Match Rate"
          value={`${(state.record_match_rate * 100).toFixed(1)}%`}
          accent
        />
        <KpiCard
          label="Financial Coverage"
          value={`${(state.financial_coverage * 100).toFixed(1)}%`}
          accent
        />
        <KpiCard label="Total Exposure" value={formatINR(state.total_exposure)} />
        <KpiCard label="Matched" value={state.matched_count} />
        <KpiCard label="Partial" value={state.partial_count} />
        <KpiCard label="Unresolved" value={state.unresolved_count} />
        <KpiCard label="Open Exceptions" value={state.exceptions?.length ?? 0} />
      </div>
    );
  }
  