from decimal import Decimal

import pytest

from app.engines.deal_risk_engine import GovernanceRouter
from app.schemas.risk import DealRiskRequest
from app.services.risk_service import RiskService


def make_request(margin="0.25"):
    return DealRiskRequest(
        dealId="deal-routing",
        customerTier="GOLD",
        repAverageDiscount="0.10",
        dealAverageDiscount="0.10",
        marginDeal=margin,
        lines=[{
            "productId": "P1",
            "category": "HARDWARE",
            "discount": "0.10",
            "grossValue": "1000",
            "tierCeiling": "0.10",
            "categoryCeiling": "0.10",
        }],
    )


def test_low_risk():
    assert GovernanceRouter.risk_level(Decimal("30")) == "LOW"


def test_medium_risk():
    assert GovernanceRouter.risk_level(Decimal("30.01")) == "MEDIUM"
    assert GovernanceRouter.risk_level(Decimal("60")) == "MEDIUM"


def test_high_risk():
    assert GovernanceRouter.risk_level(Decimal("60.01")) == "HIGH"
    assert GovernanceRouter.risk_level(Decimal("80")) == "HIGH"


def test_critical_risk():
    assert GovernanceRouter.risk_level(Decimal("80.01")) == "CRITICAL"


def test_governance_boundaries_and_priority():
    assert GovernanceRouter.route(Decimal("29.99"), Decimal("0"), Decimal("0.15")) == "AUTO_APPROVE"
    assert GovernanceRouter.route(Decimal("30"), Decimal("0"), Decimal("0.15")) == "AUTO_APPROVE"
    assert GovernanceRouter.route(Decimal("30.01"), Decimal("0"), Decimal("0.15")) == "SALES_MANAGER_APPROVAL"
    assert GovernanceRouter.route(Decimal("65"), Decimal("0"), Decimal("0.15")) == "SALES_MANAGER_APPROVAL"
    assert GovernanceRouter.route(Decimal("65.01"), Decimal("0"), Decimal("0.15")) == GovernanceRouter.DUAL_APPROVAL
    assert GovernanceRouter.route(Decimal("25"), Decimal("0.02"), Decimal("0.15")) == "SALES_MANAGER_APPROVAL"
    assert GovernanceRouter.route(Decimal("25"), Decimal("0.05"), Decimal("0.15")) == "SALES_MANAGER_APPROVAL"
    assert GovernanceRouter.route(Decimal("25"), Decimal("0.0501"), Decimal("0.15")) == GovernanceRouter.DUAL_APPROVAL
    assert GovernanceRouter.route(Decimal("25"), Decimal("0"), Decimal("0.1499")) == GovernanceRouter.DUAL_APPROVAL


def test_service_returns_explainable_result():
    result = RiskService().analyze(make_request(margin="0.20"))
    assert result.deal_id == "deal-routing"
    assert result.governance_route == "AUTO_APPROVE"
    assert result.factors
    assert {factor.name for factor in result.factors} == {
        "MAX_SINGLE_LINE_EXCESS",
        "TOTAL_EXCESS_DISCOUNT",
        "REP_ANOMALY",
        "MARGIN_PENALTY",
    }


@pytest.mark.parametrize(
    ("risk_score", "m_excess", "margin", "route"),
    [
        ("70", "0.03", "0.22", GovernanceRouter.DUAL_APPROVAL),
        ("25", "0.03", "0.22", GovernanceRouter.SALES_MANAGER_APPROVAL),
    ],
)
def test_highest_governance_condition_wins(risk_score, m_excess, margin, route):
    assert GovernanceRouter.route(
        Decimal(risk_score), Decimal(m_excess), Decimal(margin)
    ) == route
