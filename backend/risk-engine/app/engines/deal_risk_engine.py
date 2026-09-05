from decimal import Decimal


class GovernanceRouter:
    AUTO_APPROVE = "AUTO_APPROVE"
    SALES_MANAGER_APPROVAL = "SALES_MANAGER_APPROVAL"
    DUAL_APPROVAL = "DUAL_APPROVAL"
    AUTO_APPROVAL_LIMIT = Decimal("30")
    MANAGER_APPROVAL_LIMIT = Decimal("65")
    MAX_ALLOWED_EXCESS = Decimal("0.05")
    MIN_MARGIN_FOR_MANAGER = Decimal("0.15")

    @classmethod
    def route(cls, risk_score: Decimal, m_excess: Decimal, margin_deal: Decimal) -> str:
        if (
            risk_score > cls.MANAGER_APPROVAL_LIMIT
            or m_excess > cls.MAX_ALLOWED_EXCESS
            or margin_deal < cls.MIN_MARGIN_FOR_MANAGER
        ):
            return cls.DUAL_APPROVAL
        if risk_score > cls.AUTO_APPROVAL_LIMIT or m_excess > Decimal("0"):
            return cls.SALES_MANAGER_APPROVAL
        return cls.AUTO_APPROVE

    @staticmethod
    def risk_level(risk_score: Decimal) -> str:
        if risk_score <= Decimal("30"):
            return "LOW"
        if risk_score <= Decimal("60"):
            return "MEDIUM"
        if risk_score <= Decimal("80"):
            return "HIGH"
        return "CRITICAL"
