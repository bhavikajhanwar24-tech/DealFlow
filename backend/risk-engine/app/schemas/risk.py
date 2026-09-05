from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

Decimal01 = Annotated[Decimal, Field(ge=Decimal("0"), le=Decimal("1"))]
NonNegativeDecimal = Annotated[Decimal, Field(ge=Decimal("0"))]


class RiskLine(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: str = Field(alias="productId", min_length=1)
    category: str = Field(min_length=1)
    discount: Decimal01
    gross_value: NonNegativeDecimal | None = Field(default=None, alias="grossValue")
    category_ceiling: Decimal01 = Field(alias="categoryCeiling")
    tier_ceiling: Decimal01 = Field(alias="tierCeiling")
    unit_price: NonNegativeDecimal | None = Field(default=None, alias="unitPrice")
    quantity: NonNegativeDecimal | None = None

    @model_validator(mode="after")
    def validate_value_source(self) -> "RiskLine":
        has_unit_price = self.unit_price is not None
        has_quantity = self.quantity is not None

        if has_unit_price != has_quantity:
            raise ValueError("unitPrice and quantity must be supplied together")

        if has_unit_price and has_quantity:
            if self.unit_price == 0 or self.quantity == 0:
                raise ValueError("unitPrice and quantity must be greater than zero")
            calculated_value = self.unit_price * self.quantity
            if self.gross_value is None:
                self.gross_value = calculated_value

        if self.gross_value is None:
            raise ValueError("grossValue or both unitPrice and quantity are required")

        return self


class DealRiskRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    deal_id: str = Field(alias="dealId", min_length=1)
    customer_tier: str = Field(alias="customerTier", min_length=1)
    rep_average_discount: Decimal01 | None = Field(default=Decimal("0"), alias="repAverageDiscount")
    deal_average_discount: Decimal01 = Field(alias="dealAverageDiscount")
    margin_deal: Decimal01 = Field(alias="marginDeal")
    lines: list[RiskLine] = Field(min_length=1)


class RiskFactor(BaseModel):
    name: str
    raw_value: Decimal | int | str = Field(alias="rawValue")
    contribution: Decimal
    reason: str

    model_config = ConfigDict(populate_by_name=True)


class RiskResult(BaseModel):
    deal_id: str = Field(alias="dealId")
    risk_score: Decimal = Field(alias="riskScore")
    risk_level: str = Field(alias="riskLevel")
    governance_route: str = Field(alias="governanceRoute")
    m_excess: Decimal = Field(alias="mExcess")
    e_total: Decimal = Field(alias="eTotal")
    v_total: Decimal = Field(alias="vTotal")
    rep_anomaly: Decimal = Field(alias="repAnomaly")
    margin_penalty: Decimal = Field(alias="marginPenalty")
    factors: list[RiskFactor]

    model_config = ConfigDict(populate_by_name=True)
