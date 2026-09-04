import json
from core.controller import OrchestratorController
from core.generator import LedgerIngestionPipeline
from app.evaluator.metrics import EvaluationFramework


def run_full_reconciliation():
    print("1. Ingesting multi-ledger CSV data...")
    # Updated default file paths to point to the 'data/' directory
    packets = LedgerIngestionPipeline.load_packets_from_csvs(
        inv_path="data/ERP_Invoices.csv",
        gw_path="data/Payment_Gateway.csv",
        bank_path="data/Bank_Transactions.csv",
    )
    print(f"Loaded {len(packets)} transaction packets.")

    print("\n2. Running Orchestrator Controller Close...")
    orchestrator = OrchestratorController()
    state = orchestrator.run_close(close_id="CLOSE-2026-AUG", packets=packets)

    print("\n--- CLOSE RESULTS ---")
    print(f"Total Processed: {state.records_processed}")
    print(f"Matched:         {state.matched_count}")
    print(f"Partial:         {state.partial_count}")
    print(f"Unresolved:      {state.unresolved_count}")
    print(f"Match Rate:      {state.record_match_rate * 100:.2f}%")
    print(f"Total Exposure:  ₹{state.total_exposure:,.2f}")

    print("\n3. Evaluating Precision & Recall against Ground Truth...")
    try:
        # If ground_truth.json is inside data/, use "data/ground_truth.json"
        gt_path = "data/ground_truth.json"
        with open(gt_path) as f:
            ground_truth = json.load(f)

        metrics = EvaluationFramework.evaluate_performance(
            results=state.evidence_logs, ground_truth=ground_truth
        )
        print("\n--- EVALUATION METRICS ---")
        print(f"Precision: {metrics['precision'] * 100:.2f}%")
        print(f"Recall:    {metrics['recall'] * 100:.2f}%")
        print(f"FPR:       {metrics['false_positive_rate'] * 100:.2f}%")
    except Exception as e:
        print(f"Ground truth evaluation skipped: {e}")


if __name__ == "__main__":
    run_full_reconciliation()