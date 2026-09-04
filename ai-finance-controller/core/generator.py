import os
import re
import logging
from typing import Any, Dict, List
import pandas as pd

logger = logging.getLogger("ai_finance_controller.generator")


class LedgerIngestionPipeline:
    """Ingests multi-source financial CSVs into structured packets for reconciliation."""

    @staticmethod
    def _clean_str(val: Any) -> str:
        """Strips non-alphanumeric characters for clean reference matching."""
        if pd.isna(val) or val is None:
            return ""
        return re.sub(r"[^a-zA-Z0-9]", "", str(val)).lower()

    @staticmethod
    def _to_float(val: Any) -> float:
        """Safely parses floating point numbers from formatted currency strings."""
        if pd.isna(val) or val is None:
            return 0.0
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = re.sub(r"[^\d.-]", "", str(val))
        try:
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0

    @classmethod
    def load_packets_from_csvs(
        cls,
        inv_path: str = "data/ERP_Invoices.csv",
        gw_path: str = "data/Payment_Gateway.csv",
        bank_path: str = "data/Bank_Transactions.csv",
        tax_path: str = "data/Tax_Ledger.csv",
    ) -> List[Dict[str, Any]]:
        df_inv = pd.read_csv(inv_path) if os.path.exists(inv_path) else pd.DataFrame()
        df_gw = pd.read_csv(gw_path) if os.path.exists(gw_path) else pd.DataFrame()
        df_bank = pd.read_csv(bank_path) if os.path.exists(bank_path) else pd.DataFrame()
        df_tax = pd.read_csv(tax_path) if os.path.exists(tax_path) else pd.DataFrame()

        if df_inv.empty:
            logger.warning(f"No ERP invoice records found at path: {inv_path}")
            return []

        if "merchant_ref" in df_gw.columns:
            df_gw["_clean_ref"] = df_gw["merchant_ref"].apply(cls._clean_str)
        if "description" in df_bank.columns:
            df_bank["_clean_desc"] = df_bank["description"].apply(cls._clean_str)
        if "document_ref" in df_tax.columns:
            df_tax["_clean_ref"] = df_tax["document_ref"].apply(cls._clean_str)

        packets = []

        for idx, inv in df_inv.iterrows():
            raw_inv_id = str(inv.get("invoice_id", f"INV-{1001 + idx}"))
            clean_inv_id = cls._clean_str(raw_inv_id)

            gw_matches = (
                df_gw[df_gw["_clean_ref"].str.contains(clean_inv_id, na=False)]
                if "_clean_ref" in df_gw.columns
                else pd.DataFrame()
            )
            bank_matches = (
                df_bank[df_bank["_clean_desc"].str.contains(clean_inv_id, na=False)]
                if "_clean_desc" in df_bank.columns
                else pd.DataFrame()
            )
            tax_matches = (
                df_tax[df_tax["_clean_ref"].str.contains(clean_inv_id, na=False)]
                if "_clean_ref" in df_tax.columns
                else pd.DataFrame()
            )

            gw_gross = (
                sum(cls._to_float(r) for r in gw_matches["gross_amount"])
                if not gw_matches.empty and "gross_amount" in gw_matches.columns
                else 0.0
            )
            gw_fee = (
                sum(cls._to_float(r) for r in gw_matches["fee"])
                if not gw_matches.empty and "fee" in gw_matches.columns
                else 0.0
            )
            gw_net = (
                sum(cls._to_float(r) for r in gw_matches["net_amount"])
                if not gw_matches.empty and "net_amount" in gw_matches.columns
                else gw_gross - gw_fee
            )

            # Keep track of individual bank credits as well as total sum
            bank_credits_list = (
                [cls._to_float(r) for r in bank_matches["credit"]]
                if not bank_matches.empty and "credit" in bank_matches.columns
                else [0.0]
            )
            bank_credit_total = sum(bank_credits_list)

            tax_amount = (
                cls._to_float(tax_matches.iloc[0].get("total_tax"))
                if not tax_matches.empty and "total_tax" in tax_matches.columns
                else cls._to_float(inv.get("tax"))
            )

            packets.append({
                "invoice": {
                    "id": raw_inv_id,
                    "amount": cls._to_float(inv.get("total")),
                    "tax": cls._to_float(inv.get("tax")),
                    "subtotal": cls._to_float(inv.get("subtotal")),
                },
                "gateway": {
                    "payment_count": len(gw_matches),
                    "gross": gw_gross,
                    "fee": gw_fee,
                    "net": gw_net,
                },
                "bank": {
                    "payment_count": len(bank_matches),
                    "credit": bank_credit_total,
                    "credits_list": bank_credits_list,
                },
                "tax": {
                    "total_tax": tax_amount,
                },
            })

        return packets