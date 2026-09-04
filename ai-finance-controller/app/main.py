import json
from typing import Any, Dict
from uuid import uuid4

from fastapi import Body, FastAPI, HTTPException # type: ignore

from app.evaluator.metrics import EvaluationFramework
from app.schemas.ledger import ControllerState
from core.controller import OrchestratorController
from core.forecast import CashForecastEngine
from core.generator import LedgerIngestionPipeline
from core.qa_agent import SettlementQAAgent
from core.tax_matcher import TaxLineMatcher


app = FastAPI(
    title="AI Finance Controller",
    version="1.0.0",
)

# Demo/hackathon storage.
# A database is unnecessary for this prototype.
packet_store: Dict[str, Dict[str, Any]] = {}
close_store: Dict[str, ControllerState] = {}

GROUND_TRUTH_PATH = "data/ground_truth.json"


def get_close(close_id: str) -> ControllerState:
    state = close_store.get(close_id)

    if state is None:
        raise HTTPException(
            status_code=404,
            detail=f"Close '{close_id}' not found.",
        )

    return state


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/reconcile/run")
def run_reconciliation() -> Dict[str, Any]:
    """
    Run reconciliation against the existing data/ files.
    """

    try:
        # Use the same ingestion pipeline as run_suite.py.
        packets = LedgerIngestionPipeline.load_packets_from_csvs(
            inv_path="data/ERP_Invoices.csv",
            gw_path="data/Payment_Gateway.csv",
            bank_path="data/Bank_Transactions.csv",
        )

        close_id = f"CLOSE-{uuid4().hex[:8].upper()}"
        for packet in packets:
            invoice = packet.get("invoice", {})
            txn_id = invoice.get("id")
            if txn_id:
                packet_store[txn_id] = packet

        controller = OrchestratorController()
        state = controller.run_close(
            close_id=close_id,
            packets=packets,
        )

        close_store[close_id] = state

        return {
            "close_id": close_id,
            "status": "completed",
            "records_processed": state.records_processed,
            "match_rate": state.record_match_rate,
            "financial_coverage": state.financial_coverage,
            "total_exposure": state.total_exposure,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Reconciliation failed: {exc}",
        )


@app.get("/close/{close_id}/state")
def get_close_state(close_id: str) -> ControllerState:
    """
    Return KPIs and overall close state.
    """
    return get_close(close_id)


@app.get("/close/{close_id}/exceptions")
def get_close_exceptions(close_id: str):
    """
    Return all exceptions requiring human review.
    """
    state = get_close(close_id)
    return state.exceptions


@app.get("/transaction/{transaction_id}/evidence")
def get_transaction_evidence(transaction_id: str):
    """
    Return the evidence record and reasoning for a transaction, plus the
    raw source packet if available, so the frontend can render the
    evidence node diagram.
    """

    # Search every stored close for this transaction.
    for state in close_store.values():
        for evidence in state.evidence_logs:
            if evidence.transaction_id == transaction_id:
                payload = evidence.model_dump()
                packet = packet_store.get(transaction_id)
                if packet:
                    payload["packet"] = packet
                return payload  # <-- always return once found, packet or not

    raise HTTPException(
        status_code=404,
        detail=f"Transaction '{transaction_id}' not found.",
    )


@app.get("/close/{close_id}/forecast")
def get_close_forecast(
    close_id: str,
    current_balance: float = 0.0,
):
    """
    Return 7/14/30-day cash forecast, weighted by exception severity.
    """

    state = get_close(close_id)

    return CashForecastEngine.forecast_cash(
        current_balance=current_balance,
        state=state,
    )


@app.get("/close/{close_id}/evaluation")
def get_close_evaluation(close_id: str):
    """
    Real precision/recall/FPR against the hidden ground truth, computed
    live from this close's actual evidence logs -- not a hardcoded
    snapshot from an earlier run.
    """

    state = get_close(close_id)

    try:
        with open(GROUND_TRUTH_PATH) as f:
            ground_truth = json.load(f)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Ground truth file not found at '{GROUND_TRUTH_PATH}'.",
        )

    return EvaluationFramework.evaluate_performance(
        results=state.evidence_logs,
        ground_truth=ground_truth,
    )


@app.get("/close/{close_id}/tax-matches")
def get_tax_matches(close_id: str):
    """
    Standalone tax-line reconciliation: ERP tax figure vs Tax Ledger
    entry for every invoice in this close, independent of whatever else
    happened to that invoice in the main reconciliation loop.
    """

    get_close(close_id)  # 404 if the close doesn't exist

    packets = list(packet_store.values())
    results = TaxLineMatcher.match_tax_lines(packets)
    return TaxLineMatcher.summarize(results)


@app.post("/close/{close_id}/qa")
def ask_settlement_qa(close_id: str, payload: Dict[str, str] = Body(...)):
    """
    Settlement Q&A agent. Answers questions about this close using ONLY
    the structured ControllerState (matched/partial/unresolved counts,
    exception categories, top exposures) -- never re-reads the raw CSVs.
    """

    state = get_close(close_id)
    question = payload.get("question", "").strip()

    if not question:
        raise HTTPException(status_code=400, detail="Missing 'question' in request body.")

    return SettlementQAAgent.answer(question, state)