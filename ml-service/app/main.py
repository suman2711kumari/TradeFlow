from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException

from .analysis import AnalysisRequest, analyze
from .backtest import BacktestRequest, run_backtest
from .cnn import CnnRequest, CnnUnavailable, run_cnn_comparison
from .portfolio import PortfolioRiskRequest, build_portfolio_risk

app = FastAPI(
    title="TradeFlow ML Service",
    description="Historical analysis, walk-forward ML evaluation, portfolio risk, backtesting and a 1D CNN experiment. Receives candles from the Node backend.",
    version="2.0.0",
)


def _guard(fn, payload) -> dict[str, Any]:
    try:
        return fn(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except CnnUnavailable as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # never leak a traceback to the browser
        print(f"[ml-service] {fn.__name__} failed: {exc!r}")
        raise HTTPException(status_code=500, detail="The ML service could not complete this request. Check the Python terminal for details.") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        import tensorflow  # noqa: F401
        cnn = True
    except Exception:
        cnn = False
    return {"status": "ok", "service": "TradeFlow Python ML", "cnnAvailable": cnn}


@app.post("/analyze")
def analyze_endpoint(payload: AnalysisRequest) -> dict[str, Any]:
    return _guard(analyze, payload)


@app.post("/portfolio-risk")
def portfolio_risk_endpoint(payload: PortfolioRiskRequest) -> dict[str, Any]:
    return _guard(build_portfolio_risk, payload)


@app.post("/backtest")
def backtest_endpoint(payload: BacktestRequest) -> dict[str, Any]:
    return _guard(run_backtest, payload)


@app.post("/cnn-compare")
def cnn_endpoint(payload: CnnRequest) -> dict[str, Any]:
    return _guard(run_cnn_comparison, payload)
