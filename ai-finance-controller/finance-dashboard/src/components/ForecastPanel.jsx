import { useState } from "react";
import { getForecast } from "../api";
import ForecastChart from "./ForecastChart";

function formatINR(n) {
  const sign = n < 0 ? "-" : "";
  return sign + "₹" + Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function ForecastPanel({ closeId }) {
  const [balance, setBalance] = useState(1000000); // opening balance the user can edit
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleForecast() {
    setLoading(true);
    try {
      const result = await getForecast(closeId, balance);
      setForecast(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-text-dim uppercase tracking-wide">Cash Forecast</h3>
        <div className="flex items-center gap-2">
          <span className="text-text-dim text-xs">Opening balance</span>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="bg-bg border border-border rounded px-2 py-1 w-32 text-sm text-right"
          />
          <button
            onClick={handleForecast}
            disabled={loading}
            className="bg-gold text-bg text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gold-dim transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Forecast"}
          </button>
        </div>
      </div>

      {forecast && (
        <>
          <ForecastChart currentBalance={balance} forecast={forecast} />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-text-dim text-xs uppercase">7-Day</span>
              <div className="text-xl font-mono">{formatINR(forecast.forecast_7_day)}</div>
            </div>
            <div>
              <span className="text-text-dim text-xs uppercase">14-Day</span>
              <div className="text-xl font-mono">{formatINR(forecast.forecast_14_day)}</div>
            </div>
            <div>
              <span className="text-text-dim text-xs uppercase">30-Day</span>
              <div className="text-xl font-mono">{formatINR(forecast.forecast_30_day)}</div>
            </div>
          </div>
          <div className="text-xs text-text-dim border-t border-border pt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>High severity at risk: {formatINR(forecast.drivers.high_severity_exposure)}</span>
            <span>Medium: {formatINR(forecast.drivers.medium_severity_exposure)}</span>
            <span>Low: {formatINR(forecast.drivers.low_severity_exposure)}</span>
            <span>{forecast.drivers.confirmed_matches} confirmed matches</span>
          </div>

          {(() => {
            const { high_severity_exposure: h, medium_severity_exposure: m, low_severity_exposure: l } = forecast.drivers;
            const total = h + m + l;
            if (total <= 0) return null;
            return (
              <div>
                <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(h / total) * 100}%`, background: "var(--color-red, #e35d6a)" }} />
                  <div style={{ width: `${(m / total) * 100}%`, background: "var(--color-yellow, #e8b04a)" }} />
                  <div style={{ width: `${(l / total) * 100}%`, background: "var(--color-green, #35c98b)" }} />
                </div>
                <div className="text-xs text-text-dim mt-1">
                  Exposure at risk, by severity — this mix is what shapes the curve above
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
