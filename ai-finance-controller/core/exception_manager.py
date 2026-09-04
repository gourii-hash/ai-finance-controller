from app.schemas.ledger import (
    EvidenceRecord,
    ExceptionCategory,
    ExceptionSeverity,
    FinanceException,
    MatchStatus,
)


class ExceptionManager:
    """Categorizes unresolved cases and calculates risk-weighted severity."""

    @classmethod
    def process_exception(
        cls, record: EvidenceRecord, index: int
    ) -> FinanceException:
        exposure = record.unexplained_difference

        # Categorization Logic -- mapped to the rules/values the engine and
        # LLM investigator actually produce (the previous version checked
        # MatchStatus.PARTIALLY_RESOLVED here and a "GATEWAY_FEE_DISCREPANCY"
        # rule string that nothing ever set, so almost everything fell
        # through to MISSING_SETTLEMENT regardless of the real cause).
        if "TAX_MISMATCH" in record.rules_triggered:
            category = ExceptionCategory.TAX_MISMATCH
            reason = record.ai_reasoning or "Tax ledger amount does not match the ERP tax figure."
        elif "DUPLICATE_PAYMENT_DETECTED" in record.rules_triggered:
            category = ExceptionCategory.DUPLICATE_PAYMENT
            reason = record.ai_reasoning or "Potential duplicate settlement detected across ledgers."
        elif record.explained_difference > 0 and record.unexplained_difference > 0:
            # Some evidence explains part of the gap (e.g. a gateway fee),
            # but a residual amount has no supporting evidence.
            category = ExceptionCategory.UNEXPLAINED_BANK_DIFFERENCE
            reason = record.ai_reasoning or "Part of the variance is explained; a residual amount is not."
        elif record.decision == MatchStatus.UNRESOLVED or record.explained_difference == 0:
            # No evidence explains any of the gap -- the settlement is
            # effectively missing from at least one source.
            category = ExceptionCategory.MISSING_SETTLEMENT
            reason = record.ai_reasoning or "No matching settlement evidence found for this transaction."
        else:
            category = ExceptionCategory.AMOUNT_MISMATCH
            reason = record.ai_reasoning or "Unexplained amount discrepancy."

        # Risk-Weighted Severity Calculation
        if exposure > 100000 or record.confidence < 0.6:
            severity = ExceptionSeverity.HIGH
        elif exposure > 10000:
            severity = ExceptionSeverity.MEDIUM
        else:
            severity = ExceptionSeverity.LOW

        return FinanceException(
            exception_id=f"EXC-{index:03d}",
            transaction_id=record.transaction_id,
            category=category,
            exposure_amount=exposure,
            severity=severity,
            status="Human Review Required",
            reason=reason,
        )