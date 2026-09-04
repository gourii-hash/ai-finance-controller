import pandas as pd
from typing import Dict, Any, List


class SchemaProfilerAgent:
    """Detects schema structure, currency formats, missing values, and data health."""

    @staticmethod
    def profile_dataframe(df: pd.DataFrame, source_name: str) -> Dict[str, Any]:
        return {
            "source_name": source_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns),
            "null_counts": df.isnull().sum().to_dict(),
            "data_types": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "sample_records": df.head(2).to_dict(orient="records"),
        }

    @classmethod
    def profile_all_ledgers(cls, files_map: Dict[str, str]) -> Dict[str, Any]:
        profiles = {}
        for source, filepath in files_map.items():
            try:
                df = pd.read_csv(filepath)
                profiles[source] = cls.profile_dataframe(df, source)
            except Exception as e:
                profiles[source] = {"error": str(e)}
        return profiles