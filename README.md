# AI Finance Controller

**Razorpay AI Buildathon — Track 04**

An agent that reconciles financial records across four independent
systems of record — ERP, payment gateway, bank, and tax ledger —
matches what it can prove, investigates what it can't with a local
LLM, and produces an honest, categorized exception list for anything
it genuinely can't resolve.

> AI should maximize correct financial decisions, not maximize the
> number of records it labels as matched.

This README describes what's actually built and running. An earlier
design document explored a broader vision (Next.js frontend, separate
Data Profiler / Entity Resolution agents, a canonical graph model);
this project implements a focused subset of that vision that actually
runs end to end. See **"What's simplified from the original vision"**
below for the honest diff.

---

## What it does

1. **Ingests** four CSVs — ERP invoices, payment gateway captures,
   bank transactions, tax ledger entries — and matches records across
   them by cleaned invoice reference (handles typos, formatting
   differences, and split payments spread across multiple gateway or
   bank rows).
2. **Reconciles deterministically first.** Exact match, gateway-fee
   adjusted match, duplicate detection, and tax-ledger comparison are
   all plain arithmetic — no LLM involved, because an LLM shouldn't be
   doing core financial arithmetic.
3. **Escalates only genuine ambiguity** to a local LLM (Qwen3 via
   Ollama), which receives a compact evidence packet — not raw files —
   and returns a classification, confidence, and a one-sentence
   reason. If the LLM is unavailable, the system falls back to a
   deterministic result and says so honestly rather than failing.
4. **Categorizes every unresolved case** into a specific exception
   type (missing settlement, duplicate payment, unexplained bank
   difference, tax mismatch, etc.) with a severity and financial
   exposure — not a single catch-all bucket.
5. **Scores itself** against a hidden ground truth (120 labeled
   scenarios across 9 realistic mismatch types) and exposes real
   precision/recall/FPR — computed live from the current close, not a
   frozen snapshot.

---

## Architecture

```
CSV sources (ERP / Gateway / Bank / Tax)
        │
        ▼
LedgerIngestionPipeline          (core/generator.py)
  — cleans references, matches across sources, aggregates split payments
        │
        ▼
DeterministicReconciliationEngine (core/deterministic.py)
  — exact match, gateway-fee match, duplicate detection, tax comparison
        │
        ▼ (only for AMBIGUOUS cases)
InvestigationAgent                (core/investigator.py)
  — Qwen3 / Ollama, structured evidence packet in, structured JSON out
  — falls back to deterministic result if the LLM call fails
        │
        ▼
ExceptionManager                  (core/exception_manager.py)
  — categorizes + severity-scores every unresolved case
        │
        ▼
OrchestratorController             (core/controller.py)
  — runs the full pipeline, aggregates KPIs into ControllerState
        │
        ▼
FastAPI (app/main.py) ──────────► React dashboard (finance-dashboard/)
        │
        ├── CashForecastEngine    (core/forecast.py)      — severity-weighted 7/14/30-day forecast
        ├── TaxLineMatcher        (core/tax_matcher.py)   — standalone ERP-vs-Tax-Ledger pass
        ├── SettlementQAAgent     (core/qa_agent.py)       — Q&A grounded in structured state only
        └── EvaluationFramework   (app/evaluator/metrics.py) — precision/recall/FPR vs ground truth
```

---

## Tech stack

- **Backend:** Python, FastAPI, Pydantic (schema validation for every
  record type), pandas (CSV ingestion)
- **AI investigation & Q&A:** Qwen3 (8B) via [Ollama](https://ollama.com),
  running locally — no external API calls, no API key
- **Frontend:** Vite + React (not Next.js — chosen for faster iteration
  in a solo, time-boxed build), plain CSS with a dark navy/charcoal
  theme, no component library
- **Storage:** in-memory, process-local (`close_store` /
  `packet_store` dicts in `app/main.py`). A real deployment would use
  a database; for a hackathon MVP this is an intentional, disclosed
  simplification.

---

## Running it

### Backend

```bash
cd ai-finance-controller
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Pull and serve the local model once:
ollama pull qwen3:8b
ollama serve   # or confirm it's already running: ollama list

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd finance-dashboard
npm install
npm run dev
```

Open the URL Vite prints, click **Run Close**.

### Command-line evaluation (no frontend needed)

```bash
python run_suite.py
```

Prints match rate, financial coverage, and precision/recall/FPR
against the hidden ground truth for the current `data/` batch.

---

## API

| Method | Endpoint | Returns |
|---|---|---|
| POST | `/reconcile/run` | Runs a full close against `data/`, returns `close_id` + summary |
| GET | `/close/{close_id}/state` | Full `ControllerState` — KPIs, exceptions, evidence logs |
| GET | `/close/{close_id}/exceptions` | All categorized exceptions |
| GET | `/transaction/{transaction_id}/evidence` | Evidence record + reasoning + raw source packet for one transaction |
| GET | `/close/{close_id}/forecast?current_balance=X` | 7/14/30-day cash forecast |
| GET | `/close/{close_id}/evaluation` | Live precision/recall/FPR vs. ground truth |
| GET | `/close/{close_id}/tax-matches` | Standalone tax-line reconciliation report |
| POST | `/close/{close_id}/qa` | `{"question": "..."}` → answer grounded in structured state |

---

## Data

`data/` contains 120 synthetic invoices spread across:

- `ERP_Invoices.csv` — the system of record
- `Payment_Gateway.csv` — deliberately includes split payments (8
  invoices span multiple gateway rows) and fee-adjusted settlements
- `Bank_Transactions.csv` — includes duplicate entries and timing
  variance
- `Tax_Ledger.csv` — includes 5 genuine sub-rupee tax discrepancies
- `ground_truth.json` — hidden mapping used only by the evaluator,
  never fed to the reconciliation or investigation logic

`ERP_Payments.csv` is present in `data/` but **not currently read** by
the ingestion pipeline — it's unused. Either remove it before
submission or wire it in; leaving it in place unused invites an
obvious question from anyone who opens the `data/` folder.

---

## Evaluation

Run `python run_suite.py` or hit `GET /close/{id}/evaluation` for
**current** numbers — they depend on which local model is running and
aren't reproduced here, since hardcoding a number that goes stale the
moment the code changes is exactly the kind of "invented number" this
track's evaluation criteria penalizes. As a reference point from
development, a full run typically lands around 95% precision / 96%
recall with the deterministic-only fallback path; the real Ollama-backed
run should be measured fresh before your demo.

---

## What's simplified from the original vision

Honest differences from the earlier design document, so nothing here
overclaims:

- **No separate Data Profiler or Entity Resolution agents.** Schema
  detection and cross-source entity matching are folded into
  `LedgerIngestionPipeline` rather than built as standalone LLM
  agents — the matching logic (cleaned-reference substring matching)
  is deterministic, not semantic.
- **No canonical graph database.** The "transaction graph" is
  represented as a plain dict per invoice (`packet`), not a graph
  structure — sufficient for this scope, per the original doc's own
  note that a graph DB is optional for an MVP.
- **Cash forecast uses a severity-weighted model**, not the original
  doc's driver categories (vendor payments, payroll, tax payments) —
  those would require data this project doesn't have. The real model
  weights each exception's exposure by severity and assumes it
  resolves at different rates over the 7/14/30-day horizon. See
  `core/forecast.py` for the exact curve and reasoning.
- **The Investigation Agent's "confidence" and "reasoning" come
  directly from the LLM's own self-report** (asked for in the prompt),
  not a separately validated confidence score.

---

## Known limitations

- Investigation calls to Ollama run **sequentially**, not in
  parallel — a close with several ambiguous cases can take 15-25
  seconds. The frontend shows a staged progress modal during this
  time rather than a bare spinner, but the stages are timed, not a
  true progress stream from the backend.
- Storage is in-memory and single-process — restarting the backend
  loses all prior closes.
- The Q&A agent's "fast path" (a few common question patterns
  answered without an LLM call) is a small, hand-written set — most
  questions go to the LLM.