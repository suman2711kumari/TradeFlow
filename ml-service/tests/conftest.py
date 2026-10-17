import numpy as np
import pandas as pd
import pytest


def make_quotes(n=760, seed=0, drift=0.0003, vol=0.012, start="2023-01-02"):
    rng = np.random.default_rng(seed)
    rets = rng.normal(drift, vol, n)
    close = 100 * np.cumprod(1 + rets)
    dates = pd.bdate_range(start, periods=n, tz="UTC")
    open_ = close * (1 + rng.normal(0, 0.003, n))
    high = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, 0.004, n)))
    low = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, 0.004, n)))
    volume = rng.integers(1_000_000, 5_000_000, n).astype(float)
    return [
        {"date": d.isoformat(), "close": float(c), "open": float(o), "high": float(h), "low": float(l), "volume": float(v)}
        for d, c, o, h, l, v in zip(dates, close, open_, high, low, volume)
    ]


def price_points(quotes):
    return [{"date": q["date"], "close": q["close"]} for q in quotes]


@pytest.fixture
def quotes():
    return make_quotes()
