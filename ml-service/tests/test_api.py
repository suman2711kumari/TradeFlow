from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_quotes, price_points

client = TestClient(app)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_analyze_endpoint_and_validation_errors():
    ok = client.post("/analyze", json={"symbol": "TCS.NS", "quotes": make_quotes(700)})
    assert ok.status_code == 200 and "walkForward" in ok.json()
    bad = client.post("/analyze", json={"symbol": "TCS.NS", "quotes": make_quotes(50)})
    assert bad.status_code == 422


def test_portfolio_endpoint():
    q = make_quotes(300)
    res = client.post("/portfolio-risk", json={
        "positions": [{"name": "TCS", "qty": 3, "avg": 100, "price": 110}],
        "histories": {"TCS": price_points(q)}, "shockPct": -10,
    })
    assert res.status_code == 200
    assert res.json()["stress"]["uniform"]["estimatedValueChange"] == -33.0
    empty = client.post("/portfolio-risk", json={"positions": [], "histories": {}})
    assert empty.status_code == 422


def test_backtest_endpoint_rejects_bad_windows():
    res = client.post("/backtest", json={"symbol": "TCS", "quotes": make_quotes(500), "fastWindow": 60, "slowWindow": 20})
    assert res.status_code == 422
