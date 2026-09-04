const SEVERITY_COLOR = {
    HIGH: "bg-red text-red",
    MEDIUM: "bg-yellow text-yellow",
    LOW: "bg-grey text-grey",
  };
  
  function formatINR(n) {
    return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }
  
  export default function ExceptionsTable({ exceptions, onSelect, selectedId }) {
    if (!exceptions?.length) {
      return <p className="text-text-dim text-sm">No exceptions to review. Everything reconciled.</p>;
    }
  
    const sorted = [...exceptions].sort((a, b) => b.exposure_amount - a.exposure_amount);
  
    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-dim text-xs uppercase tracking-wide border-b border-border">
              <th className="text-left p-3">Transaction</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Exposure</th>
              <th className="text-left p-3">Severity</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((exc) => (
              <tr
                key={exc.exception_id}
                onClick={() => onSelect(exc.transaction_id)}
                className={`border-b border-border last:border-0 cursor-pointer hover:bg-surface-hover transition-colors ${
                  selectedId === exc.transaction_id ? "bg-surface-hover" : ""
                }`}
              >
                <td className="p-3 font-mono text-gold">{exc.transaction_id}</td>
                <td className="p-3 text-text-dim">{exc.category.replaceAll("_", " ")}</td>
                <td className="p-3 text-right">{formatINR(exc.exposure_amount)}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        exc.severity === "HIGH"
                          ? "bg-red"
                          : exc.severity === "MEDIUM"
                          ? "bg-yellow"
                          : "bg-grey"
                      }`}
                    />
                    {exc.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  