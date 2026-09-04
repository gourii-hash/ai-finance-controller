import pytest
from core.deterministic import DeterministicReconciliationEngine
from app.schemas.ledger import MatchStatus

@pytest.fixture
def exact_match_packet():
    return {
        "invoice": {"id": "INV-1001", "amount": 10000.0},
        "gateway": {"payment": 9750.0, "fee": 250.0},
        "bank": {"credit": 9750.0}
    }

@pytest.fixture
def bank_variance_packet():
    return {
        "invoice": {"id": "INV-1002", "amount": 50000.0},
        "gateway": {"payment": 48750.0, "fee": 1250.0},
        "bank": {"credit": 48000.0}  # Missing 750 in bank settlement
    }

def test_deterministic_exact_match(exact_match_packet):
    record = DeterministicReconciliationEngine.reconcile(exact_match_packet)
    assert record.decision == MatchStatus.MATCHED
    assert record.confidence == 0.98
    assert record.unexplained_difference == 0.0
    assert not record.requires_human_review

def test_deterministic_bank_variance(bank_variance_packet):
    record = DeterministicReconciliationEngine.reconcile(bank_variance_packet)
    assert record.decision == MatchStatus.AMBIGUOUS
    assert record.unexplained_difference == 750.0
    assert record.requires_human_review