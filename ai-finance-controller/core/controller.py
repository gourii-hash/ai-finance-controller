import logging
from typing import Any, Dict, List
from core.deterministic import DeterministicReconciliationEngine
from core.exception_manager import ExceptionManager
from core.investigator import InvestigationAgent
from app.schemas.ledger import ControllerState, MatchStatus

logger = logging.getLogger("ai_finance_controller.controller")


class OrchestratorController:
    """Central controller orchestrating deterministic reconciliation, agent escalation, 

    and financial close state aggregation.
    """

    def __init__(self, ollama_client: Any = None):
        self.investigation_agent = InvestigationAgent(ollama_client=ollama_client)

    def run_close(
        self, close_id: str, packets: List[Dict[str, Any]]
    ) -> ControllerState:
        evidence_logs = []
        exceptions = []

        for idx, packet in enumerate(packets, start=1):
            # Step 1: Run Deterministic Engine (Trust Layer)
            res = DeterministicReconciliationEngine.reconcile(packet)

            # Step 2: Escalate to AI Investigation Agent if ambiguous
            if res.decision == MatchStatus.AMBIGUOUS:
                res = self.investigation_agent.investigate(packet, res)

            evidence_logs.append(res)

            # Step 3: Route exceptions for human review if variances remain
            if res.requires_human_review or res.unexplained_difference > 0:
                exc = ExceptionManager.process_exception(res, idx)
                exceptions.append(exc)

        # Step 4: Aggregate Close Metrics
        total_records = len(packets)
        matched = sum(
            1 for e in evidence_logs if e.decision == MatchStatus.MATCHED
        )
        partial = sum(
            1
            for e in evidence_logs
            if e.decision == MatchStatus.PARTIALLY_RESOLVED
        )
        unresolved = sum(
            1 for e in evidence_logs if e.decision == MatchStatus.UNRESOLVED
        )

        match_rate = matched / total_records if total_records > 0 else 0.0
        coverage = (
            (matched + partial) / total_records if total_records > 0 else 0.0
        )
        total_exposure = sum(e.exposure_amount for e in exceptions)

        return ControllerState(
            close_id=close_id,
            records_processed=total_records,
            matched_count=matched,
            partial_count=partial,
            unresolved_count=unresolved,
            record_match_rate=round(match_rate, 4),
            financial_coverage=round(coverage, 4),
            total_exposure=round(total_exposure, 2),
            exceptions=exceptions,
            evidence_logs=evidence_logs,
        )