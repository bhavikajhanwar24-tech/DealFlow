from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.engines.blended_discount_engine import BlendedDiscountEngine
from app.schemas.risk import DealRiskRequest


def line(product_id="P1", discount="0.10", gross_value="1000", tier="0.10", category="0.10"):
    return {
        "productId": product_id,
        "category": "HARDWARE",
        "discount": discount,
        "grossValue": gross_value,
        "tierCeiling": tier,
        "categoryCeiling": category,
    }


def request(lines, rep="0.10", deal="0.10", margin="0.30"):
    return DealRiskRequest(
        dealId="deal-001",
        customerTier="GOLD",
        repAverageDiscount=rep,
        dealAverageDiscount=deal,
        marginDeal=margin,
        lines=lines,
    )


def test_no_violation_has_zero_maximum_excess():
    result = BlendedDiscountEngine().calculate(request([line(discount="0.10")]))
    assert result.m_excess == Decimal("0")


def test_one_violation_is_discount_minus_ceiling():
    result = BlendedDiscountEngine().calculate(request([line(discount="0.18", tier="0.10")]))
    assert result.lines[0].violation == Decimal("0.08")


def test_multiple_lines_use_maximum_violation():
    result = BlendedDiscountEngine().calculate(
        request([
            line(product_id="P1", discount="0.12"),
            line(product_id="P2", discount="0.15"),
            line(product_id="P3", discount="0.08"),
        ])
    )
    assert result.m_excess == Decimal("0.05")


def test_excess_monetary_value_is_sum_of_line_excesses():
    result = BlendedDiscountEngine().calculate(
        request([
            line(product_id="P1", discount="0.15", gross_value="500000"),
            line(product_id="P2", discount="0.12", gross_value="300000"),
        ])
    )
    assert result.e_total == Decimal("31000")
    assert result.v_total == Decimal("800000")


def test_stricter_tier_or_category_ceiling_wins():
    result = BlendedDiscountEngine().calculate(
        request([line(discount="0.10", tier="0.15", category="0.08")])
    )
    assert result.lines[0].ceiling == Decimal("0.08")
    assert result.m_excess == Decimal("0.02")


def test_rep_anomaly_uses_exact_formula():
    result = BlendedDiscountEngine().calculate(request([line()], rep="0.10", deal="0.18"))
    assert result.rep_anomaly == Decimal("0.8")


def test_rep_average_zero_uses_bounded_fallback():
    result = BlendedDiscountEngine().calculate(request([line()], rep="0", deal="0.18"))
    assert result.rep_anomaly == Decimal("1")


def test_null_rep_average_uses_same_fallback():
    result = BlendedDiscountEngine().calculate(request([line()], rep=None, deal="0.18"))
    assert result.rep_anomaly == Decimal("1")


def test_margin_at_or_above_25_percent_has_no_penalty():
    engine = BlendedDiscountEngine()
    assert engine.calculate(request([line()], margin="0.25")).margin_penalty == Decimal("0")
    assert engine.calculate(request([line()], margin="0.30")).margin_penalty == Decimal("0")


def test_margin_below_25_percent_uses_exact_penalty():
    result = BlendedDiscountEngine().calculate(request([line()], margin="0.20"))
    assert result.margin_penalty == Decimal("0.20")


def test_final_formula_and_score_cap():
    result = BlendedDiscountEngine().calculate(
        request(
            [line(discount="1", gross_value="1000000", tier="0", category="0")],
            rep="0",
            deal="1",
            margin="0",
        )
    )
    assert result.risk_score == Decimal("100")
    assert result.risk_score <= Decimal("100")


def test_zero_total_gross_value_is_rejected():
    with pytest.raises(ValueError, match="total gross value"):
        BlendedDiscountEngine().calculate(request([line(gross_value="0")]))


@pytest.mark.parametrize(
    "payload",
    [
        {"dealId": "deal", "customerTier": "GOLD", "dealAverageDiscount": "0.1", "marginDeal": "0.2", "lines": []},
        {"dealId": "deal", "customerTier": "GOLD", "dealAverageDiscount": "0.1", "marginDeal": "0.2", "lines": [line(discount="-0.1")]},
        {"dealId": "deal", "customerTier": "GOLD", "dealAverageDiscount": "0.1", "marginDeal": "1.1", "lines": [line()]},
        {"dealId": "deal", "customerTier": "", "dealAverageDiscount": "0.1", "marginDeal": "0.2", "lines": [line()]},
        {"dealId": "deal", "customerTier": "GOLD", "dealAverageDiscount": "0.1", "marginDeal": "0.2", "lines": [line(tier="0.1", category="0.1", gross_value="0")]},
    ],
)
def test_invalid_deal_data_is_rejected(payload):
    if payload["lines"] and payload["lines"][0].get("grossValue") == "0":
        request_data = DealRiskRequest(**payload)
        with pytest.raises(ValueError, match="total gross value"):
            BlendedDiscountEngine().calculate(request_data)
        return
    with pytest.raises(ValidationError):
        DealRiskRequest(**payload)


def test_zero_unit_price_or_quantity_is_rejected():
    with pytest.raises(ValidationError):
        DealRiskRequest(
            dealId="deal",
            customerTier="GOLD",
            dealAverageDiscount="0.1",
            marginDeal="0.2",
            lines=[{**line(gross_value=None), "unitPrice": "0", "quantity": "2"}],
        )
