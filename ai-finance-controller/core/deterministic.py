from typing import Any, Dict
from app.schemas.ledger import EvidenceRecord, MatchStatus


class DeterministicReconciliationEngine:
    """Trust Layer: Executes zero-hallucination arithmetic & reference matching."""

    @classmethod
    def reconcile(cls, packet: Dict[str, Any]) -> EvidenceRecord:
        invoice = packet.get("invoice", {})
        gateway = packet.get("gateway", {})
        bank = packet.get("bank", {})
        tax = packet.get("tax", {})

        invoice_id = str(invoice.get("id", "UNKNOWN"))
        inv_amt = float(invoice.get("amount", 0.0))
        inv_tax = float(invoice.get("tax", 0.0))
        
        gw_net = float(gateway.get("net", 0.0))
        gw_fee = float(gateway.get("fee", 0.0))
        bank_credit = float(bank.get("credit", 0.0))
        bank_count = int(bank.get("payment_count", 0))
        tax_amount = float(tax.get("total_tax", inv_tax))

        # --- STEP 1: EXCEPTION CHECKS FIRST ---

        # Check for Duplicate Bank Credits
        if bank_count > 1 and abs(bank_credit - (inv_amt * 2)) < 0.05:
            return EvidenceRecord(
                transaction_id=invoice_id,
                decision=MatchStatus.AMBIGUOUS,
                confidence=0.95,
                explained_difference=0.0,
                unexplained_difference=0.0,
                rules_triggered=["DUPLICATE_PAYMENT_DETECTED"],
                evidence_trail=["⚠️ Duplicate bank settlement detected for reference."],
                requires_human_review=True,
            )

        # Check for Tax Ledger Discrepancies
        tax_diff = round(abs(inv_tax - tax_amount), 2)
        if tax_diff > 0.01:  # Allow 1 cent rounding tolerance
            return EvidenceRecord(
                transaction_id=invoice_id,
                decision=MatchStatus.AMBIGUOUS,
                confidence=0.90,
                explained_difference=0.0,
                unexplained_difference=tax_diff,
                rules_triggered=["TAX_MISMATCH"],
                evidence_trail=[f"⚠️ Tax ledger mismatch of ₹{tax_diff:.2f}."],
                requires_human_review=True,
            )

        # --- STEP 2: SETTLEMENT MATCHES ---

        # Exact Match (Bank Credit == Invoice Amount)
        if abs(inv_amt - bank_credit) < 0.05:
            return EvidenceRecord(
                transaction_id=invoice_id,
                decision=MatchStatus.MATCHED,
                confidence=1.0,
                explained_difference=0.0,
                unexplained_difference=0.0,
                rules_triggered=["EXACT_SETTLEMENT_MATCH"],
                evidence_trail=[f"✓ Direct bank match for ₹{bank_credit:,.2f}."],
                requires_human_review=False,
            )

        # Gateway Net Payout Match (Gross - Fee == Bank Credit)
        expected_payout = round(inv_amt - gw_fee, 2)
        if abs(bank_credit - expected_payout) < 0.05 and gw_fee > 0:
            return EvidenceRecord(
                transaction_id=invoice_id,
                decision=MatchStatus.MATCHED,
                confidence=0.98,
                explained_difference=gw_fee,
                unexplained_difference=0.0,
                rules_triggered=["RESOLVED_GATEWAY_FEE_ADJUSTMENT"],
                evidence_trail=[f"✓ Settlement matched after accounting for ₹{gw_fee:,.2f} gateway fee."],
                requires_human_review=False,
            )

        # --- STEP 3: RESIDUAL UNRESOLVED VARIANCE ---
        unexplained = round(abs(inv_amt - gw_fee - bank_credit), 2)
        return EvidenceRecord(
            transaction_id=invoice_id,
            decision=MatchStatus.AMBIGUOUS,
            confidence=0.50,
            explained_difference=gw_fee,
            unexplained_difference=unexplained,
            rules_triggered=["PARTIAL_VARIANCE_REMAINS"],
            evidence_trail=[f"⚠️ Unresolved variance of ₹{unexplained:,.2f}."],
            requires_human_review=True,
        )