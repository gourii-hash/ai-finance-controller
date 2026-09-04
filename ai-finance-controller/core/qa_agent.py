import json
import os
import re
from collections import defaultdict
from typing import Any, Dict

from app.schemas.ledger import ControllerState


class SettlementQAAgent:
    """
    Answers natural-language questions about a close using ONLY the
    structured ControllerState -- never the raw CSVs. Per the design
    principle: retrieve relevant structured evidence first, use the LLM
    only to explain it, don't re-read the whole dataset per question.

    Two paths:
      - Fast path: a handful of common question shapes (highest exposure,
        counts, totals) are answered directly and deterministically from
        the structured facts -- instant, no LLM call, always correct.
      - LLM path: anything else goes to Ollama along with the SAME
        structured facts (not raw data), with an explicit instruction to
        answer only from what's given. Falls back to a plain summary of
        the facts if the LLM is unavailable or fails to parse.
    """

    @staticmethod
    def _build_facts(state: ControllerState) -> Dict[str, Any]:
        by_category = defaultdict(lambda: {"count": 0, "exposure": 0.0})
        by_severity = defaultdict(lambda: {"count": 0, "exposure": 0.0})

        for exc in state.exceptions:
            by_category[exc.category.value]["count"] += 1
            by_category[exc.category.value]["exposure"] += exc.exposure_amount
            by_severity[exc.severity.value]["count"] += 1
            by_severity[exc.severity.value]["exposure"] += exc.exposure_amount

        top_exceptions = sorted(
            state.exceptions, key=lambda e: e.exposure_amount, reverse=True
        )[:5]

        return {
            "close_id": state.close_id,
            "records_processed": state.records_processed,
            "matched_count": state.matched_count,
            "partial_count": state.partial_count,
            "unresolved_count": state.unresolved_count,
            "record_match_rate": state.record_match_rate,
            "total_exposure": state.total_exposure,
            "exceptions_by_category": {
                k: {"count": v["count"], "exposure": round(v["exposure"], 2)}
                for k, v in by_category.items()
            },
            "exceptions_by_severity": {
                k: {"count": v["count"], "exposure": round(v["exposure"], 2)}
                for k, v in by_severity.items()
            },
            "top_exceptions_by_exposure": [
                {
                    "transaction_id": e.transaction_id,
                    "category": e.category.value,
                    "exposure_amount": e.exposure_amount,
                    "severity": e.severity.value,
                    "reason": e.reason,
                }
                for e in top_exceptions
            ],
        }

    @staticmethod
    def _fast_path(question: str, facts: Dict[str, Any]):
        q = question.lower()

        if re.search(r"highest|largest|biggest", q) and "exposure" in q:
            if not facts["top_exceptions_by_exposure"]:
                return "There are no open exceptions with exposure right now."
            top = facts["top_exceptions_by_exposure"][0]
            return (
                f"{top['transaction_id']} has the largest exposure at "
                f"₹{top['exposure_amount']:,.2f} ({top['category'].replace('_', ' ').title()}, "
                f"{top['severity']} severity)."
            )

        if re.search(r"how much.*(exposure|money|tied up)|total exposure", q):
            return f"Total unresolved financial exposure across this close is ₹{facts['total_exposure']:,.2f}."

        if re.search(r"how many.*unresolved|unresolved.*count", q):
            return f"{facts['unresolved_count']} of {facts['records_processed']} records are unresolved."

        if re.search(r"match rate|how.*matched", q):
            return (
                f"{facts['matched_count']} of {facts['records_processed']} records matched "
                f"({facts['record_match_rate'] * 100:.1f}% match rate)."
            )

        return None

    @staticmethod
    def answer(question: str, state: ControllerState) -> Dict[str, Any]:
        facts = SettlementQAAgent._build_facts(state)

        fast_answer = SettlementQAAgent._fast_path(question, facts)
        if fast_answer:
            return {"answer": fast_answer, "source": "structured", "facts": facts}

        model = os.getenv("OLLAMA_MODEL", "qwen3:8b")
        prompt = f"""You are answering a question about a finance close, using ONLY the
structured facts below. Do not invent numbers not present here.

Facts:
{json.dumps(facts, indent=2)}

Question: {question}

Answer in 1-3 sentences, citing specific numbers from the facts above."""

        try:
            import ollama # type: ignore
            try:
                response = ollama.chat(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0},
                    think=False,
                )
            except TypeError:
                response = ollama.chat(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    options={"temperature": 0},
                )
            answer_text = response["message"]["content"].strip()
            if "<think>" in answer_text and "</think>" in answer_text:
                answer_text = answer_text.split("</think>", 1)[1].strip()
            return {"answer": answer_text, "source": "llm", "facts": facts}
        except Exception as e:
            fallback = (
                f"(LLM unavailable: {e}) Based on the current close: "
                f"{facts['matched_count']}/{facts['records_processed']} matched, "
                f"{facts['unresolved_count']} unresolved, "
                f"₹{facts['total_exposure']:,.2f} total exposure."
            )
            return {"answer": fallback, "source": "fallback", "facts": facts}