import re
from typing import Dict, Any, Optional
import pandas as pd


class EntityResolutionAgent:
    """Matches heterogeneous records across ERP, Payment Gateway, Bank, and Tax ledgers."""

    @staticmethod
    def clean_text(text: str) -> str:
        if not isinstance(text, str):
            return ""
        return re.sub(r"[^a-zA-Z0-9]", "", text).lower()

    @classmethod
    def find_invoice_matches(
        cls, invoice_id: str, df_gw: pd.DataFrame, df_bank: pd.DataFrame
    ) -> Dict[str, Any]:
        clean_inv = cls.clean_text(invoice_id)

        # Match in Gateway
        gw_match = None
        if "description" in df_gw.columns:
            matches = df_gw[
                df_gw["description"].astype(str).apply(cls.clean_text).str.contains(clean_inv)
            ]
            if not matches.empty:
                gw_match = matches.iloc[0].to_dict()

        # Match in Bank
        bank_match = None
        if "description" in df_bank.columns:
            b_matches = df_bank[
                df_bank["description"].astype(str).apply(cls.clean_text).str.contains(clean_inv)
            ]
            if not b_matches.empty:
                bank_match = b_matches.iloc[0].to_dict()

        return {
            "invoice_id": invoice_id,
            "gateway": gw_match or {},
            "bank": bank_match or {},
        }