# DealFlow360 Intelligence Service

Rule-based FastAPI service for blended discount risk scoring. It does not approve, reject, send, or mutate quotations.

## Run

```powershell
cd backend/risk-engine
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8001
```

`DATABASE_URL` is reserved for future persistence and is not required for the current stateless risk calculation.

## API

- `GET /health`
- `POST /api/ai/risk/analyze`

Percentages are decimal values (`0.10` means 10%). The service rejects missing deal data, empty lines, missing ceilings/categories, invalid percentage ranges, non-positive unit price or quantity, and zero total gross value with validation/business errors.

## Formula

For each line:

```text
L_i = min(tierCeiling_i, categoryCeiling_i)
Delta_i = max(0, discount_i - L_i)
```

Then:

```text
M_excess = max(Delta_i)
E_total = sum(Delta_i * GrossValue_i)
V_total = sum(GrossValue_i)
A_rep = max(0, (dealAverageDiscount - repAverageDiscount) / repAverageDiscount)
M_penalty = max(0, (0.25 - marginDeal) / 0.25)

R_deal = min(100,
    35 * (M_excess / 0.15)
    + 30 * (E_total / (0.10 * V_total))
    + 20 * A_rep
    + 15 * M_penalty
)
```

When historical rep average is `NULL` or zero, anomaly is `1` if the deal average is positive, otherwise `0`. Internal financial calculations use `Decimal`; values are not rounded before the response boundary.

Risk levels are `LOW` (0-30), `MEDIUM` (>30-60), `HIGH` (>60-80), and `CRITICAL` (>80-100). Governance routing is separate from risk level:

- `R_deal <= 30` and `M_excess = 0`: `AUTO_APPROVE`.
- `30 < R_deal <= 65` or `0 < M_excess <= 0.05`: `SALES_MANAGER_APPROVAL`.
- `R_deal > 65` or `M_excess > 0.05` or `marginDeal < 0.15`: `DUAL_APPROVAL` (Sales Manager, then Finance Operations).

Dual approval has priority when multiple conditions are true.

## Tests

```powershell
pytest
```
