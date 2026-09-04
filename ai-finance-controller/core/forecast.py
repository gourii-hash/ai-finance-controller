from typing import Any, Dict
from app.schemas.ledger import ControllerState


class CashForecastEngine:
    """
    Cash liquidity forecast weighted by exception severity, not a single
    blanket percentage applied to total exposure.

    Model: each exception's exposure is assumed to remain "at risk"
    (uncollected) at a rate that depends on its severity -- HIGH severity
    cases are assumed to take longer to clear through human review, LOW
    severity cases resolve fastest. As the horizon extends, less of each
    severity band's exposure remains at risk, so the forecasted balance
    recovers over time as exceptions get worked through review, rather
    than monotonically assuming everything is permanently lost by day 30.

    This uses only exposure_amount and severity, both already computed by
    ExceptionManager -- no invented payroll/vendor/tax figures.
    """

    # Fraction of a severity band's exposure still assumed uncollected
    # at each horizon. Tune these against real resolution data once you
    # have it -- these are a reasonable starting assumption, not measured.
    RISK_CURVE = {
        "HIGH":   {7: 0.90, 14: 0.60, 30: 0.20},
        "MEDIUM": {7: 0.50, 14: 0.20, 30: 0.05},
        "LOW":    {7: 0.15, 14: 0.00, 30: 0.00},
    }

    @staticmethod
    def forecast_cash(current_balance: float, state: ControllerState) -> Dict[str, Any]:
        by_severity = {"HIGH": 0.0, "MEDIUM": 0.0, "LOW": 0.0}
        for exc in state.exceptions:
            sev = exc.severity if exc.severity in by_severity else "MEDIUM"
            by_severity[sev] += exc.exposure_amount

        def at_risk(day: int) -> float:
            return sum(
                amount * CashForecastEngine.RISK_CURVE[sev][day]
                for sev, amount in by_severity.items()
            )

        day7_risk = at_risk(7)
        day14_risk = at_risk(14)
        day30_risk = at_risk(30)

        return {
            "current_balance": current_balance,
            "forecast_7_day": round(current_balance - day7_risk, 2),
            "forecast_14_day": round(current_balance - day14_risk, 2),
            "forecast_30_day": round(current_balance - day30_risk, 2),
            "drivers": {
                "high_severity_exposure": round(by_severity["HIGH"], 2),
                "medium_severity_exposure": round(by_severity["MEDIUM"], 2),
                "low_severity_exposure": round(by_severity["LOW"], 2),
                "confirmed_matches": state.matched_count,
            },
        }