from typing import Any, Dict, List


class TaxLineMatcher:
    """
    Standalone tax-line reconciliation tool.

    The main reconciliation loop already flags a TAX_MISMATCH as one rule
    among several when investigating an ambiguous case. This exposes the
    same underlying comparison (ERP tax figure vs Tax Ledger entry) as its
    own inspectable pass over every invoice, independent of whatever else
    happened to that invoice in the main loop -- so you get a clean,
    complete tax-reconciliation report rather than a side-effect buried
    inside another agent's output.
    """

    TOLERANCE = 0.005  # half a paisa -- catches real ₹0.01 discrepancies
                        # while still absorbing genuine floating-point noise

    @staticmethod
    def match_tax_lines(packets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        results = []

        for packet in packets:
            invoice = packet.get("invoice", {})
            tax = packet.get("tax", {})
            inv_id = invoice.get("id", "UNKNOWN")
            erp_tax = float(invoice.get("tax", 0.0))
            ledger_tax = tax.get("total_tax")

            if ledger_tax is None:
                results.append({
                    "transaction_id": inv_id,
                    "erp_tax": erp_tax,
                    "tax_ledger_amount": None,
                    "difference": None,
                    "status": "MISSING",
                })
                continue

            ledger_tax = float(ledger_tax)
            diff = round(abs(erp_tax - ledger_tax), 2)
            status = "MATCHED" if diff <= TaxLineMatcher.TOLERANCE else "MISMATCH"

            results.append({
                "transaction_id": inv_id,
                "erp_tax": erp_tax,
                "tax_ledger_amount": ledger_tax,
                "difference": diff,
                "status": status,
            })

        return results

    @staticmethod
    def summarize(results: List[Dict[str, Any]]) -> Dict[str, Any]:
        matched = sum(1 for r in results if r["status"] == "MATCHED")
        mismatch = sum(1 for r in results if r["status"] == "MISMATCH")
        missing = sum(1 for r in results if r["status"] == "MISSING")
        total_mismatch_exposure = round(
            sum(r["difference"] for r in results if r["status"] == "MISMATCH"), 2
        )

        return {
            "total": len(results),
            "matched": matched,
            "mismatch": mismatch,
            "missing": missing,
            "total_mismatch_exposure": total_mismatch_exposure,
            "lines": results,
        }
