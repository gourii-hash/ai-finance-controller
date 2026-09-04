from typing import Any, Dict, List
from app.schemas.ledger import EvidenceRecord, MatchStatus


class EvaluationFramework:
    """Evaluates AI & deterministic reconciliation decisions against ground truth dataset."""

    @staticmethod
    def evaluate_performance(
        results: List[EvidenceRecord], ground_truth: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        gt_map = {}
        for item in ground_truth:
            key = item.get("invoice_id") or item.get("transaction_id")
            if key:
                gt_map[str(key)] = item

        tp, fp, fn, tn = 0, 0, 0, 0

        for res in results:
            gt = gt_map.get(str(res.transaction_id), {})
            expected_status = str(gt.get("status", "")).upper()
            if not expected_status:
                continue

            actual_status = res.decision.value.upper()

            # Align status classifications with ground truth categories
            is_match = False
            if actual_status == expected_status:
                is_match = True
            elif actual_status == "MATCHED" and expected_status in [
                "MATCHED",
                "RESOLVED_ADJUSTMENT",
            ]:
                is_match = True
            elif actual_status in ["AMBIGUOUS", "PARTIALLY_RESOLVED", "UNRESOLVED"] and expected_status in [
                "EXCEPTION_TAX_MISMATCH",
                "EXCEPTION_DUPLICATE",
                "PARTIAL_UNRESOLVED",
            ]:
                is_match = True

            if is_match:
                if expected_status in ["MATCHED", "RESOLVED_ADJUSTMENT"]:
                    tp += 1
                else:
                    tn += 1
            else:
                if res.decision == MatchStatus.MATCHED:
                    fp += 1
                else:
                    fn += 1

        total = tp + fp + fn + tn
        # Return decimal fractions (0.0 to 1.0) for run_suite.py formatting
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        f1_score = (
            2 * (precision * recall) / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )

        return {
            "precision": precision,
            "recall": recall,
            "f1_score": f1_score,
            "false_positive_rate": fpr,
            "total_evaluated": total,
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
        }