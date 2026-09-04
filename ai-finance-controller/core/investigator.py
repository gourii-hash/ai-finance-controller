import json
import logging
import os
from typing import Any, Dict, Optional

from app.schemas.ledger import EvidenceRecord, MatchStatus

logger = logging.getLogger("ai_finance_controller.investigator")

# Maps the LLM's classification string straight onto the schema's enum.
_CLASSIFICATION_TO_STATUS = {
    "MATCHED": MatchStatus.MATCHED,
    "PARTIALLY_RESOLVED": MatchStatus.PARTIALLY_RESOLVED,
    "UNRESOLVED": MatchStatus.UNRESOLVED,
    "AMBIGUOUS": MatchStatus.AMBIGUOUS,
}


class InvestigationAgent:
    """LLM / Heuristic Agent responsible for deep investigation of unresolved variances.

    Cheap, genuinely-deterministic patterns (tax mismatch, duplicate payment,
    a gateway fee that fully explains the gap) are still handled by fast
    rule checks below -- there's no reason to pay for an LLM call on an
    exact arithmetic match. The LLM is only invoked for the residual
    "PARTIAL_VARIANCE_REMAINS" case: a genuine judgment call the rules
    couldn't resolve, which is what an LLM should actually be doing here.
    """

    def __init__(
        self,
        llm_client: Any = None,
        ollama_client: Any = None,
        model: str = None,
        **kwargs: Any,
    ):
        # Support both llm_client and ollama_client parameter names
        self.llm = ollama_client or llm_client
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3:8b")

    def investigate(self, packet: Dict[str, Any], evidence: EvidenceRecord) -> EvidenceRecord:
        """Analyzes edge cases, tax mismatches, or partial settlements."""
        if evidence.decision == MatchStatus.MATCHED:
            return evidence

        invoice = packet.get("invoice", {})
        gw = packet.get("gateway", {})
        bank = packet.get("bank", {})
        tax = packet.get("tax", {})

        inv_amt = float(invoice.get("amount", 0.0))
        inv_tax = float(invoice.get("tax", 0.0))
        tax_total = float(tax.get("total_tax", inv_tax))
        gw_fee = float(gw.get("fee", 0.0))
        bank_credit = float(bank.get("credit", 0.0))

        rules = list(evidence.rules_triggered)
        trail = list(evidence.evidence_trail)

        if "TAX_MISMATCH" in rules:
            trail.append(f"Investigated tax ledger variance: ERP={inv_tax}, TaxLedger={tax_total}")
            return EvidenceRecord(
                transaction_id=evidence.transaction_id,
                decision=MatchStatus.AMBIGUOUS,
                confidence=0.90,
                explained_difference=0.0,
                unexplained_difference=round(abs(inv_tax - tax_total), 2),
                rules_triggered=rules,
                evidence_trail=trail,
                requires_human_review=True,
            )

        if "DUPLICATE_PAYMENT_DETECTED" in rules:
            trail.append("Investigated potential duplicate bank settlement entry.")
            return EvidenceRecord(
                transaction_id=evidence.transaction_id,
                decision=MatchStatus.AMBIGUOUS,
                confidence=0.95,
                explained_difference=0.0,
                unexplained_difference=0.0,
                rules_triggered=rules,
                evidence_trail=trail,
                requires_human_review=True,
            )

        if gw_fee > 0 and abs(bank_credit - (inv_amt - gw_fee)) < 0.05:
            rules.append("INVESTIGATED_GW_FEE_MATCH")
            trail.append(f"Gateway fee of ₹{gw_fee:,.2f} confirmed.")
            return EvidenceRecord(
                transaction_id=evidence.transaction_id,
                decision=MatchStatus.MATCHED,
                confidence=0.98,
                explained_difference=gw_fee,
                unexplained_difference=0.0,
                rules_triggered=rules,
                evidence_trail=trail,
                requires_human_review=False,
            )

        # --- Everything above was still deterministic. This is the actual
        # residual case: a genuine variance the rules couldn't explain.
        # This is where an LLM call belongs -- previously nothing happened
        # here at all, the evidence just passed through unchanged.
        return self._investigate_with_llm(packet, evidence)

    def _investigate_with_llm(self, packet: Dict[str, Any], evidence: EvidenceRecord) -> EvidenceRecord:
        prompt = _build_prompt(packet, evidence)
        try:
            import ollama
            try:
                # think=False turns off Qwen3's reasoning trace, so the
                # response is just the JSON we asked for -- faster too.
                # Older ollama-python versions don't have this param.
                response = ollama.chat(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0},
                    think=False,
                )
            except TypeError:
                response = ollama.chat(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0},
                )
            parsed = _parse_llm_json(response["message"]["content"])
            return _record_from_parsed(evidence, parsed)
        except Exception as e:
            logger.warning(f"Ollama investigation failed for {evidence.transaction_id}: {e}")
            trail = list(evidence.evidence_trail)
            trail.append(f"[LLM investigation unavailable: {e}. Kept deterministic result.]")
            evidence.evidence_trail = trail
            return evidence


def _build_prompt(packet: Dict[str, Any], evidence: EvidenceRecord) -> str:
    invoice = packet.get("invoice", {})
    gw = packet.get("gateway", {})
    bank = packet.get("bank", {})

    return f"""You are reconciling one invoice against payment gateway and bank records.

Evidence packet:
{json.dumps({"invoice": invoice, "gateway": gw, "bank": bank}, indent=2)}

Deterministic engine already checked exact match and gateway-fee-adjusted
match, and neither explained the gap. Unexplained difference so far:
₹{evidence.unexplained_difference:,.2f}

Decide the correct classification:
- MATCHED: the remaining difference is fully explainable
- PARTIALLY_RESOLVED: some of the difference is explainable, some is not
- UNRESOLVED: none of the difference is explainable from this evidence
- AMBIGUOUS: contradictory evidence, needs a human to decide

Respond ONLY with JSON, no markdown fences, no text outside the JSON:
{{"classification": "MATCHED"|"PARTIALLY_RESOLVED"|"UNRESOLVED"|"AMBIGUOUS", "confidence": 0.0-1.0, "explained_difference": <number>, "unexplained_difference": <number>, "reason": "<one sentence>", "requires_human_review": true|false}}"""


def _parse_llm_json(raw: str) -> dict:
    cleaned = raw.strip()
    # Qwen3 (and other hybrid-reasoning models) often prepend a
    # <think>...</think> block before the actual answer, even when
    # asked for JSON only. Strip it before looking for the JSON object.
    if "<think>" in cleaned:
        if "</think>" in cleaned:
            cleaned = cleaned.split("</think>", 1)[1].strip()
        else:
            # Model got cut off mid-thought and never reached the answer.
            raise ValueError("Response was still inside a <think> block, no JSON found.")
    if "```" in cleaned:
        cleaned = cleaned.split("```")[1] if cleaned.count("```") >= 2 else cleaned
        cleaned = cleaned.replace("json", "", 1).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start:end + 1]
    return json.loads(cleaned)


def _record_from_parsed(evidence: EvidenceRecord, parsed: dict) -> EvidenceRecord:
    classification = parsed.get("classification", "AMBIGUOUS")
    status = _CLASSIFICATION_TO_STATUS.get(classification, MatchStatus.AMBIGUOUS)

    rules = list(evidence.rules_triggered) + ["LLM_INVESTIGATED"]
    trail = list(evidence.evidence_trail) + [f"LLM: {parsed.get('reason', 'No reason given.')}"]

    return EvidenceRecord(
        transaction_id=evidence.transaction_id,
        decision=status,
        confidence=float(parsed.get("confidence", 0.5)),
        explained_difference=float(parsed.get("explained_difference", evidence.explained_difference)),
        unexplained_difference=float(parsed.get("unexplained_difference", evidence.unexplained_difference)),
        rules_triggered=rules,
        evidence_trail=trail,
        requires_human_review=bool(parsed.get("requires_human_review", True)),
        ai_reasoning=parsed.get("reason"),
    )