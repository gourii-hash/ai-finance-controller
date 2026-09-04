function formatINR(n) {
    if (n === undefined || n === null) return "—";
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  
  // Decide edge color per the spec's convention:
  // GREEN = verified, YELLOW = AI-inferred, RED = mismatch, GREY = missing
  function edgeColor({ hasSource, aiInvolved, decision }) {
    if (!hasSource) return "var(--color-grey)";
    if (decision === "UNRESOLVED") return "var(--color-red)";
    if (aiInvolved) return "var(--color-yellow)";
    return "var(--color-green)";
  }
  
  function Node({ label, amount, present }) {
    return (
      <div
        className={`border rounded-lg px-4 py-3 text-center min-w-[120px] ${
          present ? "border-border bg-surface" : "border-border/50 bg-surface/40"
        }`}
      >
        <div className="text-xs text-text-dim uppercase tracking-wide">{label}</div>
        <div className={`text-lg font-mono mt-1 ${present ? "text-text" : "text-text-dim"}`}>
          {present ? formatINR(amount) : "missing"}
        </div>
      </div>
    );
  }
  
  function Edge({ color }) {
    return (
      <div className="flex-1 h-0.5 mx-2 rounded" style={{ backgroundColor: color, minWidth: 24 }} />
    );
  }
  
  export default function EvidenceGraph({ evidence, packet }) {
    if (!evidence) return null;
  
    const aiInvolved = evidence.rules_triggered?.some((r) => r.includes("LLM") || r.includes("INVESTIGATED"));
  
    // Graceful fallback: if the backend doesn't (yet) return raw packet
    // amounts, skip the node diagram and just show the evidence text --
    // still useful, just not the full visual.
    const hasPacket = Boolean(packet);
  
    return (
      <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-5 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-gold text-lg">{evidence.transaction_id}</h3>
          <span
            className={`text-xs px-2 py-1 rounded-full border ${
              evidence.decision === "MATCHED"
                ? "border-green text-green"
                : evidence.decision === "UNRESOLVED"
                ? "border-red text-red"
                : "border-yellow text-yellow"
            }`}
          >
            {evidence.decision} · {(evidence.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
  
        {hasPacket ? (
          <div className="overflow-x-auto py-4">
            <div className="flex items-center px-2 w-max min-w-full justify-center">
              <Node label="ERP Invoice" amount={packet.invoice?.amount} present={Boolean(packet.invoice)} />
              <Edge color={edgeColor({ hasSource: Boolean(packet.gateway), aiInvolved, decision: evidence.decision })} />
              <Node label="Gateway" amount={packet.gateway?.net} present={Boolean(packet.gateway)} />
              <Edge color={edgeColor({ hasSource: Boolean(packet.bank), aiInvolved, decision: evidence.decision })} />
              <Node label="Bank" amount={packet.bank?.credit} present={Boolean(packet.bank)} />
              <Edge color={edgeColor({ hasSource: Boolean(packet.tax), aiInvolved, decision: evidence.decision })} />
              <Node label="Tax Ledger" amount={packet.tax?.total_tax} present={Boolean(packet.tax)} />
            </div>
          </div>
        ) : (
          <p className="text-text-dim text-xs italic">
            Node diagram needs raw packet data from the API — see setup note. Showing evidence trail below.
          </p>
        )}
  
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-dim text-xs uppercase">Explained</span>
            <div className="text-green font-mono text-lg">{formatINR(evidence.explained_difference)}</div>
          </div>
          <div>
            <span className="text-text-dim text-xs uppercase">Unexplained</span>
            <div className="text-red font-mono text-lg">{formatINR(evidence.unexplained_difference)}</div>
          </div>
        </div>
  
        <div className="flex flex-wrap gap-2">
          {evidence.rules_triggered?.map((rule) => (
            <span key={rule} className="text-xs px-2 py-1 bg-surface-hover border border-border rounded text-text-dim">
              {rule}
            </span>
          ))}
        </div>
  
        <div>
          <span className="text-text-dim text-xs uppercase tracking-wide">Evidence trail</span>
          <ul className="mt-1 space-y-1 text-sm">
            {evidence.evidence_trail?.map((line, i) => (
              <li key={i} className="text-text-dim">{line}</li>
            ))}
          </ul>
        </div>
  
        {evidence.ai_reasoning && (
          <div className="border-t border-border pt-4">
            <span className="text-text-dim text-xs uppercase tracking-wide">AI reasoning</span>
            <p className="text-sm mt-1 italic">{evidence.ai_reasoning}</p>
          </div>
        )}
  
        {evidence.requires_human_review && (
          <div className="text-xs text-yellow border border-yellow/40 rounded px-3 py-2 bg-yellow/5">
            ⚠ Human review required
          </div>
        )}
      </div>
    );
  }
  