import { useState, useEffect } from "react";
import {
  runReconciliation,
  getCloseState,
  getExceptions,
  getEvidence,
  getEvaluation,
  getTaxMatches,
  askSettlementQA,
} from "./api";

import KpiCards from "./components/KpiCards";
import ExceptionsTable from "./components/ExceptionsTable";
import EvidenceGraph from "./components/EvidenceGraph";
import ForecastPanel from "./components/ForecastPanel";

import "./App.css";

/* =========================================================
   ICONS
   ========================================================= */

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),

    close: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M8 3v4M16 3v4M4 9h16" />
        <path d="M8 13h3M13 13h3M8 16h3" />
      </>
    ),

    exceptions: (
      <>
        <path d="M10.3 3.5 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 16h.01" />
      </>
    ),

    evidence: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M8.3 7.2 10.8 16M15.7 7.2 13.2 16M8.5 6h7" />
      </>
    ),

    forecast: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <path d="m7 15 3-4 3 2 5-7" />
        <path d="M18 6h2v2" />
      </>
    ),

    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 5v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.4h.8a1.7 1.7 0 0 0 1.6-1A1.7 1.7 0 0 0 8.1 8L8 7.9l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5H15v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.4h-.1a1.7 1.7 0 0 0-1.5 1.6Z" />
      </>
    ),

    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8" />
        <path d="M10 21h4" />
      </>
    ),

    play: (
      <>
        <path d="m8 5 11 7-11 7V5Z" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),

    spark: (
      <>
        <path d="m12 2 1.4 6.6L20 10l-6.6 1.4L12 18l-1.4-6.6L4 10l6.6-1.4L12 2Z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

/* =========================================================
   SIDEBAR
   ========================================================= */

function Sidebar({ activePage, setActivePage }) {
  const items = [
    { id: "overview", label: "Overview", icon: "dashboard" },
    { id: "close", label: "Close", icon: "close" },
    { id: "exceptions", label: "Exceptions", icon: "exceptions" },
    { id: "evidence", label: "Evidence", icon: "evidence" },
    { id: "forecast", label: "Forecast", icon: "forecast" },
    { id: "history", label: "Run History", icon: "history" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="spark" size={17} />
        </div>

        <div className="brand-copy">
          <div className="brand-title">AI FINANCE</div>
          <div className="brand-subtitle">Controller</div>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-label">Workspace</div>

        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">
              <Icon name={item.icon} size={17} />
            </span>

            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot" />
          System Online
        </div>

        <div className="ai-status">
          AI INVESTIGATION ACTIVE
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   TOP BAR
   ========================================================= */

function TopBar({
  closeId,
  loading,
  onRunClose,
  activePage,
}) {
  const titles = {
    overview: {
      title: "Finance Control Center",
      subtitle:
        "Automated reconciliation, explainable investigation & cash visibility",
    },

    close: {
      title: "Close Management",
      subtitle:
        "Run and monitor your reconciliation close process",
    },

    exceptions: {
      title: "Exceptions",
      subtitle:
        "Cases requiring human attention",
    },

    evidence: {
      title: "Evidence Investigation",
      subtitle:
        "Understand exactly why a transaction was classified",
    },

    forecast: {
      title: "Cash Forecast",
      subtitle:
        "Projected cash position based on reconciliation exposure",
    },

    history: {
      title: "Run History",
      subtitle:
        "Previous reconciliation close runs",
    },
  };

  const current = titles[activePage] ?? titles.overview;

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">AUGUST 2026 CLOSE</div>

        <h1 className="page-title">
          {current.title}
        </h1>

        <div className="page-subtitle">
          {current.subtitle}
        </div>
      </div>

      <div className="topbar-actions">
        {closeId && (
          <div className="close-id">
            {closeId}
          </div>
        )}

        <button
          className="run-button"
          onClick={onRunClose}
          disabled={loading}
        >
          <Icon name="play" size={13} />

          {loading ? "Running..." : "Run Close"}
        </button>
      </div>
    </header>
  );
}

/* =========================================================
   INGESTION STATUS
   ========================================================= */

function IngestionStatus({ state }) {
  const records = state?.records_processed ?? 0;

  const sources = [
    {
      name: "ERP Invoices",
      count: `${records} / ${records}`,
    },
    {
      name: "Payment Gateway",
      count: `${records} / ${records}`,
    },
    {
      name: "Bank Transactions",
      count: `${records} / ${records}`,
    },
  ];

  return (
    <section>
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            Data Ingestion
          </h2>

          <div className="section-description">
            Source files processed for the current close
          </div>
        </div>
      </div>

      <div className="ingestion-grid">
        {sources.map((source) => (
          <div className="ingestion-card" key={source.name}>
            <div className="ingestion-left">
              <div className="ingestion-icon">
                <Icon name="check" size={14} />
              </div>

              <div>
                <div className="ingestion-name">
                  {source.name}
                </div>

                <div className="ingestion-count">
                  {source.count} records
                </div>
              </div>
            </div>

            <div className="ingestion-status">
              <span className="status-dot" />
              Loaded
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   RECONCILIATION SUMMARY
   ========================================================= */

function ReconciliationSummary({ state }) {
  if (!state) return null;

  const total = state.records_processed || 1;

  const matched =
    ((state.matched_count ?? 0) / total) * 100;

  const partial =
    ((state.partial_count ?? 0) / total) * 100;

  const unresolved =
    ((state.unresolved_count ?? 0) / total) * 100;

  return (
    <div className="panel reconciliation-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            Reconciliation Summary
          </h2>

          <div className="section-description">
            Current close health across all transaction packets
          </div>
        </div>
      </div>

      <div className="summary-numbers">
        <div className="summary-number">
          <div className="summary-number-label">
            Matched
          </div>

          <div className="summary-number-value green">
            {state.matched_count ?? 0}
          </div>
        </div>

        <div className="summary-number">
          <div className="summary-number-label">
            Partial
          </div>

          <div className="summary-number-value yellow">
            {state.partial_count ?? 0}
          </div>
        </div>

        <div className="summary-number">
          <div className="summary-number-label">
            Unresolved
          </div>

          <div className="summary-number-value red">
            {state.unresolved_count ?? 0}
          </div>
        </div>

        <div className="summary-number">
          <div className="summary-number-label">
            Match Rate
          </div>

          <div className="summary-number-value">
            {(
              (state.record_match_rate ?? 0) * 100
            ).toFixed(1)}
            %
          </div>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-match"
          style={{ width: `${matched}%` }}
        />

        <div
          className="progress-partial"
          style={{ width: `${partial}%` }}
        />

        <div
          className="progress-unresolved"
          style={{ width: `${unresolved}%` }}
        />
      </div>

      <div className="legend">
        <div className="legend-item">
          <span
            className="legend-dot"
            style={{ background: "#35c98b" }}
          />
          Matched
        </div>

        <div className="legend-item">
          <span
            className="legend-dot"
            style={{ background: "#e8b04a" }}
          />
          Partial
        </div>

        <div className="legend-item">
          <span
            className="legend-dot"
            style={{ background: "#e35d6a" }}
          />
          Unresolved
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   AI METRICS
   ========================================================= */

function AiMetrics({ closeId }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!closeId) return;
    let cancelled = false;
    getEvaluation(closeId)
      .then((m) => !cancelled && setMetrics(m))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [closeId]);

  return (
    <div className="panel ai-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            AI Investigation Performance
          </h2>

          <div className="section-description">
            Evaluation / benchmark metrics
          </div>
        </div>

        <Icon name="spark" size={15} />
      </div>

      {error && <div className="metric-row"><span className="metric-label">Error</span><span className="metric-value">{error}</span></div>}

      {!metrics && !error && (
        <div className="metric-row">
          <span className="metric-label">Loading live metrics…</span>
        </div>
      )}

      {metrics && (
        <>
          <div className="metric-row">
            <span className="metric-label">Precision</span>
            <span className="metric-value">{(metrics.precision * 100).toFixed(2)}%</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">Recall</span>
            <span className="metric-value">{(metrics.recall * 100).toFixed(2)}%</span>
          </div>

          <div className="metric-row">
            <span className="metric-label">False Positive Rate</span>
            <span className="metric-value">{(metrics.false_positive_rate * 100).toFixed(2)}%</span>
          </div>

          <div className="metric-row">
            <span className="metric-label" style={{ opacity: 0.6 }}>
              {metrics.total_evaluated} records evaluated against hidden ground truth
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   TAX LINE MATCHER
   ========================================================= */

function TaxMatchPanel({ closeId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!closeId) return;
    let cancelled = false;
    getTaxMatches(closeId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [closeId]);

  return (
    <div className="panel reconciliation-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Tax-Line Matcher</h2>
          <div className="section-description">
            ERP tax figure vs Tax Ledger, checked independently for every invoice
          </div>
        </div>
      </div>

      {error && <div className="metric-row"><span className="metric-label">{error}</span></div>}
      {!data && !error && <div className="metric-row"><span className="metric-label">Loading…</span></div>}

      {data && (
        <>
          <div className="summary-numbers">
            <div className="summary-number">
              <div className="summary-number-label">Matched</div>
              <div className="summary-number-value green">{data.matched}</div>
            </div>
            <div className="summary-number">
              <div className="summary-number-label">Mismatch</div>
              <div className="summary-number-value red">{data.mismatch}</div>
            </div>
            <div className="summary-number">
              <div className="summary-number-label">Missing</div>
              <div className="summary-number-value yellow">{data.missing}</div>
            </div>
            <div className="summary-number">
              <div className="summary-number-label">Mismatch Exposure</div>
              <div className="summary-number-value">
                ₹{data.total_mismatch_exposure.toFixed(2)}
              </div>
            </div>
          </div>

          {data.mismatch > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-warning, #e8b04a)",
                  marginBottom: 10,
                }}
              >
                Found {data.mismatch} discrepanc{data.mismatch === 1 ? "y" : "ies"} down to the paisa —
                the kind of gap manual review typically misses.
              </div>
              {data.lines
                .filter((l) => l.status === "MISMATCH")
                .slice(0, 5)
                .map((l) => (
                  <div className="metric-row" key={l.transaction_id}>
                    <span className="metric-label">{l.transaction_id}</span>
                    <span className="metric-value">
                      ERP ₹{l.erp_tax.toFixed(2)} vs Ledger ₹{l.tax_ledger_amount.toFixed(2)}
                      {"  ·  Δ ₹"}{l.difference.toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                padding: "16px 0",
                textAlign: "center",
                color: "var(--color-success, #35c98b)",
                fontSize: 13,
              }}
            >
              ✓ Every tax line reconciled cleanly against the ledger
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =========================================================
   SETTLEMENT Q&A
   ========================================================= */

function SettlementQAPanel({ closeId }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]); // {question, answer, source}
  const [asking, setAsking] = useState(false);

  async function handleAsk() {
    if (!question.trim() || !closeId) return;
    setAsking(true);
    try {
      const result = await askSettlementQA(closeId, question);
      setHistory((h) => [...h, { question, answer: result.answer, source: result.source }]);
      setQuestion("");
    } catch (e) {
      setHistory((h) => [...h, { question, answer: `Error: ${e.message}`, source: "error" }]);
    } finally {
      setAsking(false);
    }
  }

  const suggestions = [
    "What is the highest exposure exception?",
    "How much money is tied up in unresolved cases?",
    "How many records matched?",
  ];

  return (
    <div className="panel reconciliation-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">Ask the Controller</h2>
          <div className="section-description">
            Answers are grounded in this close's structured results, not raw files
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          placeholder="e.g. Which category has the highest exception rate?"
          style={{
            flex: 1,
            background: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "var(--color-text)",
          }}
        />
        <button className="run-button" onClick={handleAsk} disabled={asking || !closeId}>
          {asking ? "Asking…" : "Ask"}
        </button>
      </div>

      {history.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              className="nav-item"
              style={{ width: "auto", height: 28, fontSize: 12, margin: 0 }}
              onClick={() => setQuestion(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: history.length ? 8 : 0 }}>
        {history.slice().reverse().map((h, i) => (
          <div key={i}>
            <div className="metric-label" style={{ marginBottom: 4 }}>{h.question}</div>
            <div className="section-description" style={{ color: "var(--color-text)" }}>{h.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
}



function ExposureCard({ state, exceptions }) {
  const exposure = Number(
    state?.total_exposure ?? 0
  ).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

  return (
    <div className="panel exposure-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            Open Exposure
          </h2>

          <div className="section-description">
            Financial value requiring attention
          </div>
        </div>

        <Icon name="exceptions" size={16} />
      </div>

      <div className="exposure-value">
        ₹{exposure}
      </div>

      <div className="exposure-caption">
        {exceptions?.length ?? 0} cases require human review
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState({ onRunClose, loading }) {
  return (
    <div className="panel empty-state">
      <div className="empty-icon">
        <Icon name="spark" size={22} />
      </div>

      <div className="empty-title">
        No close has been run yet
      </div>

      <div className="empty-description">
        Run the reconciliation close to load your ERP,
        payment gateway and bank data and begin AI-assisted
        investigation.
      </div>

      <button
        className="run-button"
        style={{ marginTop: 22 }}
        onClick={onRunClose}
        disabled={loading}
      >
        <Icon name="play" size={13} />
        {loading ? "Running..." : "Run First Close"}
      </button>
    </div>
  );
}

/* =========================================================
   RUN CLOSE PROGRESS MODAL
   ========================================================= */

const RUN_CLOSE_STAGES = [
  "Loading ERP invoices",
  "Loading payment gateway",
  "Loading bank transactions",
  "Matching transactions",
  "Investigating exceptions with AI",
  "Calculating exposure",
  "Generating forecast",
];

function RunCloseModal({ visible, stageIndex, complete, summary, onViewExceptions, onViewEvidence, onClose }) {
  if (!visible) return null;

  return (
    <div
      onClick={complete ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 6, 14, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          maxWidth: "90vw",
          padding: 28,
          transition: "opacity 200ms ease",
        }}
      >
        {!complete ? (
          <>
            <h2 className="section-title" style={{ marginBottom: 4 }}>
              Running August Close
            </h2>
            <div className="section-description" style={{ marginBottom: 20 }}>
              This can take up to 20-30s while the AI investigates uncertain cases.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {RUN_CLOSE_STAGES.map((label, i) => {
                const done = i < stageIndex;
                const active = i === stageIndex;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        flexShrink: 0,
                        background: done
                          ? "var(--color-green)"
                          : active
                          ? "var(--color-blue)"
                          : "transparent",
                        border: done || active ? "none" : "1px solid var(--color-border-strong)",
                        color: "#fff",
                      }}
                      className={active ? "pulse-dot" : ""}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: done ? "var(--color-text)" : active ? "var(--color-text)" : "var(--color-text-muted)",
                        transition: "color 200ms ease",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h2 className="section-title" style={{ marginBottom: 4, color: "var(--color-green)" }}>
              Close Complete
            </h2>
            <div className="section-description" style={{ marginBottom: 20 }}>
              {summary.records_processed} transactions processed · {(summary.record_match_rate * 100).toFixed(1)}% match rate
            </div>

            <div className="summary-numbers" style={{ marginBottom: 20 }}>
              <div className="summary-number">
                <div className="summary-number-label">Matched</div>
                <div className="summary-number-value green">{summary.matched_count}</div>
              </div>
              <div className="summary-number">
                <div className="summary-number-label">Partial</div>
                <div className="summary-number-value yellow">{summary.partial_count}</div>
              </div>
              <div className="summary-number">
                <div className="summary-number-label">Unresolved</div>
                <div className="summary-number-value red">{summary.unresolved_count}</div>
              </div>
              <div className="summary-number">
                <div className="summary-number-label">Exposure</div>
                <div className="summary-number-value">₹{summary.total_exposure.toLocaleString("en-IN")}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="run-button" style={{ flex: 1 }} onClick={onViewExceptions}>
                View Exceptions
              </button>
              <button
                className="nav-item"
                style={{ flex: 1, width: "auto", height: 38, margin: 0, justifyContent: "center" }}
                onClick={onViewEvidence}
              >
                View Evidence
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}



function Overview({
  state,
  exceptions,
  closeId,
  selectedEvidence,
  onSelectTransaction,
  loading,
  onRunClose,
}) {
  if (!state) {
    return (
      <EmptyState
        onRunClose={onRunClose}
        loading={loading}
      />
    );
  }

  return (
    <>
      <IngestionStatus state={state} />

      <div style={{ height: 16 }} />

      <KpiCards state={state} />

      <div style={{ height: 16 }} />

      <div className="dashboard-grid">
        <ReconciliationSummary state={state} />

        <div className="side-stack">
          <ExposureCard
            state={state}
            exceptions={exceptions}
          />

          <AiMetrics closeId={closeId} />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel reconciliation-panel">
          <div className="panel-header">
            <div>
              <h2 className="section-title">
                Recent Exceptions
              </h2>

              <div className="section-description">
                Highest financial exposure requiring review
              </div>
            </div>

            <button
              className="nav-item"
              style={{
                width: "auto",
                height: 32,
                margin: 0,
              }}
              onClick={() => {}}
            >
              View all
              <Icon name="arrow" size={13} />
            </button>
          </div>

          <ExceptionsTable
            exceptions={exceptions}
            onSelect={onSelectTransaction}
            selectedId={
              selectedEvidence?.transaction_id
            }
          />
        </div>

        <div className="panel reconciliation-panel">
          <div className="panel-header">
            <div>
              <h2 className="section-title">
                Evidence Investigation
              </h2>

              <div className="section-description">
                {selectedEvidence
                  ? `Investigation for ${selectedEvidence.transaction_id}`
                  : "Select an exception to inspect its evidence"}
              </div>
            </div>
          </div>

          {selectedEvidence ? (
            <EvidenceGraph
              evidence={selectedEvidence}
              packet={selectedEvidence.packet}
            />
          ) : (
            <div
              style={{
                minHeight: 250,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#697489",
                fontSize: 11,
                textAlign: "center",
                padding: 30,
              }}
            >
              Select a transaction from the exception
              table to see the evidence trail.
            </div>
          )}
        </div>
      </div>

      {closeId && (
        <>
          <div style={{ height: 16 }} />
          <ForecastPanel closeId={closeId} />

          <div style={{ height: 16 }} />
          <div
            className="dashboard-grid"
            style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}
          >
            <TaxMatchPanel closeId={closeId} />
            <SettlementQAPanel closeId={closeId} />
          </div>
        </>
      )}
    </>
  );
}

/* =========================================================
   EXCEPTIONS PAGE
   ========================================================= */

function ExceptionsPage({
  exceptions,
  onSelectTransaction,
  selectedEvidence,
}) {
  return (
    <div className="panel reconciliation-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            Exception Queue
          </h2>

          <div className="section-description">
            Transactions requiring human attention
          </div>
        </div>
      </div>

      <ExceptionsTable
        exceptions={exceptions}
        onSelect={onSelectTransaction}
        selectedId={
          selectedEvidence?.transaction_id
        }
      />
    </div>
  );
}

/* =========================================================
   EVIDENCE PAGE
   ========================================================= */

function EvidencePage({
  selectedEvidence,
}) {
  return (
    <div className="panel reconciliation-panel">
      <div className="panel-header">
        <div>
          <h2 className="section-title">
            Evidence Investigation
          </h2>

          <div className="section-description">
            Explainable transaction reconciliation
          </div>
        </div>
      </div>

      {selectedEvidence ? (
        <EvidenceGraph
          evidence={selectedEvidence}
          packet={selectedEvidence.packet}
        />
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="evidence" size={22} />
          </div>

          <div className="empty-title">
            Select a transaction
          </div>

          <div className="empty-description">
            Open an exception and select a transaction
            to inspect the ERP, gateway, bank and tax
            evidence.
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

export default function App() {
  const [activePage, setActivePage] =
    useState("overview");

  const [closeId, setCloseId] =
    useState(null);

  const [state, setState] =
    useState(null);

  const [exceptions, setExceptions] =
    useState([]);

  const [selectedEvidence, setSelectedEvidence] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [runModal, setRunModal] = useState(
    { visible: false, stageIndex: 0, complete: false, summary: null }
  );

  async function handleRunClose() {
    setLoading(true);
    setError(null);
    setRunModal({ visible: true, stageIndex: 0, complete: false, summary: null });

    // Cycle through the stage list while the real request is in flight.
    // Holds on the last "in progress" stage rather than racing ahead of
    // the actual response -- this doesn't reflect true backend progress
    // (the request is one synchronous call), but it stops 20 seconds of
    // sequential Ollama calls from looking like a frozen button.
    let stage = 0;
    const interval = setInterval(() => {
      stage = Math.min(stage + 1, RUN_CLOSE_STAGES.length - 1);
      setRunModal((m) => ({ ...m, stageIndex: stage }));
    }, 2500);

    try {
      const result =
        await runReconciliation();

      const id =
        result.close_id ??
        result.id ??
        result.closeId;

      if (!id) {
        throw new Error(
          "Couldn't find close_id in /reconcile/run response."
        );
      }

      setCloseId(id);

      const [
        newState,
        newExceptions,
      ] = await Promise.all([
        getCloseState(id),
        getExceptions(id),
      ]);

      setState(newState);
      setExceptions(newExceptions);

      setSelectedEvidence(null);

      clearInterval(interval);
      setRunModal({ visible: true, stageIndex: RUN_CLOSE_STAGES.length, complete: true, summary: newState });
    } catch (e) {
      clearInterval(interval);
      setRunModal({ visible: false, stageIndex: 0, complete: false, summary: null });
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectTransaction(
    transactionId
  ) {
    try {
      setError(null);

      const evidence =
        await getEvidence(transactionId);

      setSelectedEvidence(evidence);

      setActivePage("evidence");
    } catch (e) {
      setError(e.message);
    }
  }

  function renderPage() {
    if (!state) {
      return (
        <EmptyState
          onRunClose={handleRunClose}
          loading={loading}
        />
      );
    }

    switch (activePage) {
      case "exceptions":
        return (
          <ExceptionsPage
            exceptions={exceptions}
            onSelectTransaction={
              handleSelectTransaction
            }
            selectedEvidence={
              selectedEvidence
            }
          />
        );

      case "evidence":
        return (
          <EvidencePage
            selectedEvidence={
              selectedEvidence
            }
          />
        );

      case "forecast":
        return (
          <ForecastPanel
            closeId={closeId}
          />
        );

      case "close":
        return (
          <Overview
            state={state}
            exceptions={exceptions}
            closeId={closeId}
            selectedEvidence={
              selectedEvidence
            }
            onSelectTransaction={
              handleSelectTransaction
            }
            loading={loading}
            onRunClose={handleRunClose}
          />
        );

      case "history":
        return (
          <div className="panel empty-state">
            <div className="empty-icon">
              <Icon name="history" size={22} />
            </div>

            <div className="empty-title">
              Run History
            </div>

            <div className="empty-description">
              Historical close runs will appear here.
            </div>
          </div>
        );

      case "overview":
      default:
        return (
          <Overview
            state={state}
            exceptions={exceptions}
            closeId={closeId}
            selectedEvidence={
              selectedEvidence
            }
            onSelectTransaction={
              handleSelectTransaction
            }
            loading={loading}
            onRunClose={handleRunClose}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <main className="main-content">
        <div className="content-width">
          <TopBar
            closeId={closeId}
            loading={loading}
            onRunClose={handleRunClose}
            activePage={activePage}
          />

          {error && (
            <div className="error-banner">
              <Icon name="exceptions" size={15} />
              <span>{error}</span>
            </div>
          )}

          {renderPage()}
        </div>
      </main>

      <RunCloseModal
        visible={runModal.visible}
        stageIndex={runModal.stageIndex}
        complete={runModal.complete}
        summary={runModal.summary}
        onViewExceptions={() => {
          setActivePage("exceptions");
          setRunModal((m) => ({ ...m, visible: false }));
        }}
        onViewEvidence={() => {
          setActivePage("evidence");
          setRunModal((m) => ({ ...m, visible: false }));
        }}
        onClose={() => setRunModal((m) => ({ ...m, visible: false }))}
      />
    </div>
  );
}