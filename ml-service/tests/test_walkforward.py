import numpy as np
import pytest

from app.analysis import AnalysisRequest, analyze, run_walk_forward, walk_forward_splits
from app.common import FEATURES, Candle, build_frame
from tests.conftest import make_quotes


def test_splits_never_overlap_and_respect_gap():
    n = 700
    prev_test_end = None
    for train_end, test_start, test_end in walk_forward_splits(n, 5, gap=1):
        assert train_end <= test_start - 1          # at least one session purged
        assert test_start < test_end <= n
        if prev_test_end is not None:
            assert test_start == prev_test_end       # test blocks are contiguous
        prev_test_end = test_end
    assert prev_test_end == n


def test_features_use_only_past_data():
    q = make_quotes(400, seed=5)
    full = build_frame([Candle(**x) for x in q])
    truncated = build_frame([Candle(**x) for x in q[:300]])
    # Features of an early row must be identical whether or not future rows exist.
    row = 250
    for col in FEATURES:
        assert full[col].iloc[row] == pytest.approx(truncated[col].iloc[row], nan_ok=True)


def test_random_walk_gets_no_credit_and_reports_no_edge(quotes):
    out = analyze(AnalysisRequest(symbol="TEST.NS", quotes=[Candle(**x) for x in quotes]))
    wf = out["walkForward"]
    assert wf["nSplits"] == 5 and len(wf["folds"]) == 5
    assert "_pooled" not in wf
    summary = {r["model"]: r for r in wf["summary"]}
    assert 40 <= summary["Logistic Regression"]["accuracyPct"] <= 62   # a random walk can't be predicted
    for row in wf["summary"]:
        c = row["confusion"]
        assert c["tp"] + c["fp"] + c["tn"] + c["fn"] == wf["pooledSessions"]
    assert out["backtest"]["costBpsPerSide"] == 10
    assert out["backtest"]["strategyReturnPct"] <= out["backtest"]["strategyGrossReturnPct"] + 1e-9
    assert out["prediction"]["edgeAssessment"].startswith("No demonstrated edge")


def test_planted_signal_is_detected():
    """A series where next-day direction depends on today's return must produce above-baseline accuracy."""
    rng = np.random.default_rng(3)
    n = 760
    rets = np.zeros(n)
    for i in range(1, n):
        rets[i] = -0.6 * rets[i - 1] + rng.normal(0, 0.01)   # strong mean reversion
    close = 100 * np.cumprod(1 + rets)
    import pandas as pd
    dates = pd.bdate_range("2023-01-02", periods=n, tz="UTC")
    quotes = [Candle(date=d.isoformat(), close=float(c)) for d, c in zip(dates, close)]
    out = analyze(AnalysisRequest(symbol="PLANTED", quotes=quotes))
    lr = next(r for r in out["walkForward"]["summary"] if r["model"] == "Logistic Regression")
    assert lr["accuracyPct"] > 65


def test_too_little_history_is_rejected():
    with pytest.raises(ValueError):
        analyze(AnalysisRequest(symbol="X", quotes=[Candle(**x) for x in make_quotes(120)]))
