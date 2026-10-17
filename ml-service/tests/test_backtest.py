import numpy as np
import pandas as pd
import pytest

from app.backtest import BacktestRequest, _simulate, run_backtest
from app.common import Candle
from tests.conftest import make_quotes


def _req(quotes, **kw):
    return BacktestRequest(symbol="TEST", quotes=[Candle(**q) for q in quotes], **kw)


def test_costs_reduce_return_and_are_reported():
    q = make_quotes(700, seed=11)
    free = run_backtest(_req(q, costBps=0))
    costly = run_backtest(_req(q, costBps=50))
    assert costly["strategy"]["totalReturnPct"] <= free["strategy"]["totalReturnPct"]
    assert free["strategy"]["totalCostsInr"] == 0
    assert costly["strategy"]["totalCostsInr"] > 0
    assert costly["strategy"]["grossReturnPct"] == pytest.approx(free["strategy"]["totalReturnPct"], abs=0.01)


def test_no_lookahead_position_uses_previous_day_signal():
    ret = pd.Series([0.0, 0.10, -0.10, 0.05, 0.05])
    signal = pd.Series([1.0, 0.0, 1.0, 1.0, 0.0])
    position, _, net = _simulate(ret, signal, 0.0)
    assert position.tolist() == [0.0, 1.0, 0.0, 1.0, 1.0]   # shifted by one day
    assert net.iloc[1] == pytest.approx(0.10)               # earned the day-1 move because signal[0]==1
    assert net.iloc[2] == 0.0                               # signal[1]==0 so flat on day 2 (avoids the -10%)


def test_trade_count_and_curve_shape():
    q = make_quotes(700, seed=4, vol=0.02)
    out = run_backtest(_req(q, fastWindow=10, slowWindow=30))
    assert out["strategy"]["trades"] == len(out["recentTrades"]) or out["strategy"]["trades"] > 12
    assert out["equityCurve"][0]["strategy"] > 0 and len(out["equityCurve"]) <= 305
    assert 0 <= out["strategy"]["exposurePct"] <= 100
    assert out["strategy"]["maxDrawdownPct"] <= 0


def test_invalid_windows_rejected():
    with pytest.raises(ValueError):
        _req(make_quotes(300), fastWindow=50, slowWindow=20)
