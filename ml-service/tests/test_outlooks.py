import math

from app.analysis import AnalysisRequest, analyze
from app.common import Candle
from app.portfolio import PortfolioPosition, PortfolioRiskRequest, PricePoint, build_portfolio_risk
from tests.conftest import make_quotes


def test_stock_outlook_is_finite_and_ordered():
    quotes = make_quotes(760, seed=11)
    result = analyze(AnalysisRequest(symbol="TCS.NS", quotes=[Candle(**q) for q in quotes]))
    outlook = result["priceOutlook"]
    assert outlook["lastHistoricalClose"] > 0
    assert outlook["lowerIllustration"] <= outlook["illustrativePrice"] <= outlook["upperIllustration"]
    assert math.isfinite(outlook["illustrativePrice"])
    assert result["prediction"]["walkForwardAccuracyPct"] >= 0


def test_portfolio_outlook_has_five_and_twenty_day_illustrations():
    q1 = make_quotes(260, seed=12)
    q2 = make_quotes(260, seed=13)
    positions = [
        PortfolioPosition(name="TCS", qty=2, avg=100, price=120),
        PortfolioPosition(name="INFY", qty=3, avg=100, price=110),
    ]
    payload = PortfolioRiskRequest(
        positions=positions,
        histories={
            "TCS": [PricePoint(date=q["date"], close=q["close"]) for q in q1],
            "INFY": [PricePoint(date=q["date"], close=q["close"]) for q in q2],
        },
        benchmark=None,
    )
    result = build_portfolio_risk(payload)
    periods = result["outlook"]["periods"]
    assert [p["tradingDays"] for p in periods] == [5, 20]
    for p in periods:
        assert p["lowerIllustration"] <= p["illustrativeValue"] <= p["upperIllustration"]
        assert p["lowerIllustration"] >= 0
        assert math.isfinite(p["illustrativeValue"])
