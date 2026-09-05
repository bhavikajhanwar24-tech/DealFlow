from dataclasses import dataclass
from decimal import Decimal

from app.schemas.risk import DealRiskRequest

ZERO = Decimal("0")
ONE = Decimal("1")
QUARTER = Decimal("0.25")


@dataclass(frozen=True)
class LineCalculation:
    product_id: str
    ceiling: Decimal
    violation: Decimal
    gross_value: Decimal


@dataclass(frozen=True)
class BlendedDiscountResult:
    m_excess: Decimal
    e_total: Decimal
    v_total: Decimal
    rep_anomaly: Decimal
    margin_penalty: Decimal
    risk_score: Decimal
    lines: tuple[LineCalculation, ...]


class BlendedDiscountEngine:
    """Pure deterministic implementation of the canonical blended-risk formula."""

    def calculate(self, request: DealRiskRequest) -> BlendedDiscountResult:
        line_results = tuple(self._calculate_line(line) for line in request.lines)
        v_total = sum((line.gross_value for line in line_results), ZERO)
        if v_total <= ZERO:
            raise ValueError("total gross value must be greater than zero")

        m_excess = max((line.violation for line in line_results), default=ZERO)
        e_total = sum(
            (line.violation * line.gross_value for line in line_results),
            ZERO,
        )
        rep_anomaly = self._rep_anomaly(
            request.deal_average_discount,
            request.rep_average_discount,
        )
        margin_penalty = max(
            ZERO,
            (QUARTER - request.margin_deal) / QUARTER,
        )
        risk_score = min(
            Decimal("100"),
            Decimal("35") * (m_excess / Decimal("0.15"))
            + Decimal("30") * (e_total / (Decimal("0.10") * v_total))
            + Decimal("20") * rep_anomaly
            + Decimal("15") * margin_penalty,
        )

        return BlendedDiscountResult(
            m_excess=m_excess,
            e_total=e_total,
            v_total=v_total,
            rep_anomaly=rep_anomaly,
            margin_penalty=margin_penalty,
            risk_score=risk_score,
            lines=line_results,
        )

    @staticmethod
    def _calculate_line(line) -> LineCalculation:
        ceiling = min(line.tier_ceiling, line.category_ceiling)
        violation = max(ZERO, line.discount - ceiling)
        return LineCalculation(
            product_id=line.product_id,
            ceiling=ceiling,
            violation=violation,
            gross_value=line.gross_value,
        )

    @staticmethod
    def _rep_anomaly(deal_average: Decimal, rep_average: Decimal | None) -> Decimal:
        historical_average = rep_average or ZERO
        if historical_average == ZERO:
            return ONE if deal_average > ZERO else ZERO
        return max(ZERO, (deal_average - historical_average) / historical_average)
