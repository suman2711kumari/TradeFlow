import numpy as np
import pytest

from app.portfolio import PortfolioRiskRequest, build_portfolio_risk
from tests.conftest import make_quotes, price_points


def _request(histories, positions, bench=None, shock=-5):
    return PortfolioRiskRequest(positions=positions, histories=histories, benchmark=bench, shockPct=shock)


def test_risk_contributions_sum_to_100_and_diversification_works():
    a, b = make_quotes(300, seed=1), make_quotes(300, seed=2)  # independent assets
    req = _request(
        {"TCS": price_points(a), "ITC": price_points(b)},
        [{"name": "TCS", "qty": 10, "avg": 100, "price": 100}, {"name": "ITC", "qty": 10, "avg": 100, "price": 100}],
        bench=price_points(make_quotes(300, seed=3)),
    )
    out = build_portfolio_risk(req)
    contrib = sum(h["riskContributionPct"] for h in out["holdings"])
    assert contrib == pytest.approx(100, abs=0.2)
    vols = [h["annualizedVolatilityPct"] for h in out["holdings"]]
    # Portfolio of two independent assets must be less risky than the weighted average of the parts.
    assert out["summary"]["annualizedVolatilityPct"] < np.mean(vols)
    assert out["summary"]["diversificationRatio"] > 1.0
    assert out["summary"]["maxDrawdownPct"] <= 0
    assert out["summary"]["var95OneDayPct"] > 0
    assert out["summary"]["expectedShortfall95Pct"] >= out["summary"]["var95OneDayPct"]

def test_identical_assets_have_correlation_one_and_no_diversification():
    a = make_quotes(300, seed=1)
    req = _request(
        {"TCS": price_points(a), "INFY": price_points(a)},
        [{"name": "TCS", "qty": 5, "avg": 100, "price": 100}, {"name": "INFY", "qty": 5, "avg": 100, "price": 100}],
    )
    out = build_portfolio_risk(req)
    assert out["summary"]["averagePairwiseCorrelation"] == pytest.approx(1.0, abs=0.01)
    assert out["summary"]["diversificationRatio"] == pytest.approx(1.0, abs=0.01)
    assert any("move together" in f for f in out["flags"])


def test_stress_test_values_and_beta_adjustment():
    mkt = make_quotes(300, seed=7)
    req = _request(
        {"TCS": price_points(mkt)},  # a stock identical to the market has beta 1
        [{"name": "TCS", "qty": 10, "avg": 90, "price": 100}],
        bench=price_points(mkt), shock=-5,
    )
    out = build_portfolio_risk(req)
    assert out["stress"]["uniform"]["estimatedValueChange"] == pytest.approx(-50.0)
    assert out["holdings"][0]["beta"] == pytest.approx(1.0, abs=0.01)
    assert out["stress"]["betaAdjusted"]["estimatedValueChange"] == pytest.approx(-50.0, abs=1.0)
    assert out["stress"]["historicalWorst"]["worstDay"]["returnPct"] < 0


def test_missing_history_is_reported_not_hidden():
    a = make_quotes(300, seed=1)
    req = _request(
        {"TCS": price_points(a), "ITC": price_points(a[:10])},
        [{"name": "TCS", "qty": 1, "avg": 100, "price": 100}, {"name": "ITC", "qty": 1, "avg": 100, "price": 100}],
    )
    out = build_portfolio_risk(req)
    assert out["window"]["coveragePct"] == pytest.approx(50.0)
    assert any("ITC" in w for w in out["warnings"])
    assert any(h["symbol"] == "ITC" and h["riskContributionPct"] is None for h in out["holdings"])


def test_no_holdings_or_no_history_raises():
    with pytest.raises(ValueError):
        build_portfolio_risk(_request({}, []))
    with pytest.raises(ValueError):
        build_portfolio_risk(_request({}, [{"name": "TCS", "qty": 1, "avg": 1, "price": 1}]))
