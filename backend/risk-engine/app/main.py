from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.risk import router as risk_router

app = FastAPI(title="DealFlow360 Intelligence Service", version="1.0.0")
app.include_router(risk_router)


@app.exception_handler(ValueError)
async def business_validation_error(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "dealflow360-intelligence"}
