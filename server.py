"""
Traderra Indicator Server — FastAPI bridge between browser chart and Python indicators.

Endpoints:
  GET  /api/indicators          — JSON schemas for all indicators
  POST /api/calc/{indicator_key} — Run indicator calculation
  GET  /api/health              — Health check

Usage:
  cd /home/mdwzrd/traderra
  uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

# Import the indicator framework (auto-discovers all indicators)
from traderra_indicators import REGISTRY

app = FastAPI(title="Traderra Indicator Server", version="0.1.0")

# CORS — allow the browser chart to call from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request/Response models ──

class CalcRequest(BaseModel):
    """Browser sends OHLCV data + indicator params + color overrides."""
    params: dict[str, Any] = {}
    colors: dict[str, str] = {}
    data: list[dict[str, Any]]  # [{t, o, h, l, c, v}, ...]


class CalcResponse(BaseModel):
    """Server returns indicator results."""
    key: str
    params: dict[str, Any]
    result: dict[str, Any]


# ── Endpoints ──

@app.get("/api/health")
async def health():
    return {"status": "ok", "indicators": len(REGISTRY)}


@app.get("/api/indicators")
async def get_indicators():
    """Return JSON schemas for all registered indicators."""
    return {key: cls.schema() for key, cls in REGISTRY.items()}


@app.post("/api/calc/{indicator_key}", response_model=CalcResponse)
async def calc_indicator(indicator_key: str, req: CalcRequest):
    """Run an indicator calculation with the given params and data."""
    if indicator_key not in REGISTRY:
        raise HTTPException(404, f"Unknown indicator: {indicator_key}")

    import pandas as pd

    # Convert data to DataFrame
    df = pd.DataFrame(req.data)
    col_map = {"t": "time", "o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"}
    df.rename(columns={k: v for k, v in col_map.items() if k in df.columns}, inplace=True)

    # Ensure required columns
    for col in ["open", "high", "low", "close"]:
        if col not in df.columns:
            raise HTTPException(400, f"Missing column: {col}")
    if "volume" not in df.columns:
        df["volume"] = 0

    # Numeric conversion
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Create indicator instance with params
    ind_cls = REGISTRY[indicator_key]
    ind = ind_cls(**req.params)

    # Run calculation
    result = ind.calc(df)

    return CalcResponse(
        key=indicator_key,
        params=ind._values,
        result=result,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
