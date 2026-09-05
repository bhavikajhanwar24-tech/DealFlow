from decimal import Decimal

from app.engines.blended_discount_engine import BlendedDiscountEngine, BlendedDiscountResult
from app.engines.deal_risk_engine import GovernanceRouter
from app.schemas.risk import DealRiskRequest, RiskFactor, RiskResult


class RiskService:
    def __init__(self, engine: BlendedDiscountEngine | None = None) -> None:
        self.engine = engine or BlendedDiscountEngine()

    def analyze(self, request: DealRiskRequest) -> RiskResult:
        calculation = self.engine.calculate(request)
        return RiskResult(
            dealId=request.deal_id,
            riskScore=calculation.risk_score,
            riskLevel=GovernanceRouter.risk_level(calculation.risk_score),
            governanceRoute=GovernanceRouter.route(
                calculation.risk_score,
                calculation.m_excess,
                request.margin_deal,
            ),
            mExcess=calculation.m_excess,
            eTotal=calculation.e_total,
            vTotal=calculation.v_total,
            repAnomaly=calculation.rep_anomaly,
            marginPenalty=calculation.margin_penalty,
            factors=self._factors(calculation),
        )

    @staticmethod
    def _factors(calculation: BlendedDiscountResult) -> list[RiskFactor]:
        zero = Decimal("0")
        single_line_contribution = calculation.m_excess / Decimal("0.15") * Decimal("35")
        total_excess_contribution = (
            calculation.e_total / (calculation.v_total * Decimal("0.10")) * Decimal("30")
            if calculation.v_total > zero
            else zero
        )
        return [
            RiskFactor(
                name="MAX_SINGLE_LINE_EXCESS",
                rawValue=calculation.m_excess,
                contribution=single_line_contribution,
                reason=(
                    f"Maximum line discount exceeds the applicable ceiling by "
                    f"{calculation.m_excess * 100}% ."
                ).replace("% .", "%."),
            ),
            RiskFactor(
                name="TOTAL_EXCESS_DISCOUNT",
                rawValue=calculation.e_total,
                contribution=total_excess_contribution,
                reason="Total excess discount is measured against 10% of total gross value.",
            ),
            RiskFactor(
                name="REP_ANOMALY",
                rawValue=calculation.rep_anomaly,
                contribution=calculation.rep_anomaly * 20,
                reason="Deal discount is compared with the salesperson's historical average.",
            ),
            RiskFactor(
                name="MARGIN_PENALTY",
                rawValue=calculation.margin_penalty,
                contribution=calculation.margin_penalty * 15,
                reason="Deal margin is evaluated against the 25% target.",
            ),
        ]
