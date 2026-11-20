import numpy as np
import pandas as pd
import pytest

from app.portfolio import PortfolioRiskRequest, build_portfolio_risk
from tests.conftest import make_quotes, price_points


def test_missing_nifty_history_never_pretends_beta_is_one():
    prices = price_points(make_quotes(300, seed=32))
    report = build_portfolio_risk(PortfolioRiskRequest(
        positions=[{"name": "TCS", "qty": 2, "avg": 100, "price": 100}],
        histories={"TCS": prices},
        benchmark=None,
        shockPct=-5,
    ))
    assert report["summary"]["beta"] is None
    assert report["holdings"][0]["beta"] is None
    scenario = report["stress"]["betaAdjusted"]
    assert scenario["available"] is False
    assert scenario["estimatedValueChange"] is None
    assert scenario["perHolding"][0]["betaUsed"] is None
    assert report["stress"]["uniform"]["estimatedValueChange"] == -10.0
    assert any("NIFTY 50" in text for text in report["warnings"])


def test_real_betas_are_calculated_from_history_instead_of_forced_to_one():
    rng = np.random.default_rng(72)
    market_returns = rng.normal(0.0002, 0.009, 260)
    market_close = 100 * np.cumprod(1 + market_returns)
    stock_close = 100 * np.cumprod(1 + 1.4 * market_returns)
    dates = pd.bdate_range("2025-01-01", periods=260, tz="UTC")
    make_points = lambda closes: [
        {"date": day.isoformat(), "close": float(close)}
        for day, close in zip(dates, closes)
    ]
    report = build_portfolio_risk(PortfolioRiskRequest(
        positions=[{"name": "TCS", "qty": 2, "avg": 100, "price": 100}],
        histories={"TCS": make_points(stock_close)},
        benchmark=make_points(market_close),
        shockPct=-5,
    ))
    assert report["summary"]["beta"] == pytest.approx(1.4, abs=0.01)
    assert report["holdings"][0]["beta"] == pytest.approx(1.4, abs=0.01)
    assert report["stress"]["betaAdjusted"]["available"] is True
    assert report["stress"]["betaAdjusted"]["perHolding"][0]["betaUsed"] == pytest.approx(1.4, abs=0.01)
