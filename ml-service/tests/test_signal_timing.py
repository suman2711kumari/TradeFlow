import numpy as np
import pandas as pd
from app.analysis import backtest_signal


def test_signal_is_not_executed_at_its_own_closing_price():
    # Signal from the first session is acted on only after a full-session delay.
    meta = pd.DataFrame({
        "next_return": [0.10, 0.05, -0.03],
        "lr_prob": [0.9, 0.1, 0.1],
    })
    out = backtest_signal(meta, threshold=0.55, cost_bps=0)
    # The original signal's 10% return cannot be captured using its own closing data.
    assert out["strategyGrossReturnPct"] == 5.0
    assert out["trades"] == 1
