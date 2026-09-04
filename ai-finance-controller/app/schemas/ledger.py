from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class MatchStatus(str, Enum):
    MATCHED = "MATCHED"
    PARTIALLY_RESOLVED = "PARTIALLY_RESOLVED"
    UNRESOLVED = "UNRESOLVED"
    AMBIGUOUS = "AMBIGUOUS"


class ExceptionSeverity(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ExceptionCategory(str, Enum):
    MISSING_SETTLEMENT = "MISSING_SETTLEMENT"
    DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT"
    PARTIAL_PAYMENT = "PARTIAL_PAYMENT"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    TAX_MISMATCH = "TAX_MISMATCH"
    TIMING_VARIANCE = "TIMING_VARIANCE"
    UNEXPLAINED_BANK_DIFFERENCE = "UNEXPLAINED_BANK_DIFFERENCE"
    UNSUPPORTED_ADJUSTMENT = "UNSUPPORTED_ADJUSTMENT"


class EvidenceRecord(BaseModel):
    transaction_id: str
    decision: MatchStatus
    confidence: float
    explained_difference: float = 0.0
    unexplained_difference: float = 0.0
    rules_triggered: List[str] = Field(default_factory=list)
    evidence_trail: List[str] = Field(default_factory=list)
    requires_human_review: bool = True
    ai_reasoning: Optional[str] = None


class FinanceException(BaseModel):
    exception_id: str
    transaction_id: str
    category: ExceptionCategory
    exposure_amount: float
    severity: ExceptionSeverity
    status: str = "Human Review Required"
    reason: str


class ControllerState(BaseModel):
    close_id: str
    records_processed: int
    matched_count: int
    partial_count: int
    unresolved_count: int
    record_match_rate: float
    financial_coverage: float
    total_exposure: float
    exceptions: List[FinanceException] = Field(default_factory=list)
    evidence_logs: List[EvidenceRecord] = Field(default_factory=list)