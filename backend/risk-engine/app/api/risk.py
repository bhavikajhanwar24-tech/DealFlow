from fastapi import APIRouter

from app.schemas.risk import DealRiskRequest, RiskResult
from app.services.risk_service import RiskService

router = APIRouter(prefix="/api/ai/risk", tags=["risk"])
risk_service = RiskService()


@router.post("/analyze", response_model=RiskResult)
def analyze_risk(request: DealRiskRequest) -> RiskResult:
    return risk_service.analyze(request)
