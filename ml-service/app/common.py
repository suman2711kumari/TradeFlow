"""Shared data model, feature engineering and metric helpers.

Every feature at row t uses information available at the close of day t only.
The label at row t is whether close[t+1] > close[t]; the final row therefore has
no label (it is the row we predict "live").
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

FEATURES = ["return_1", "momentum_5", "momentum_10", "sma_gap_10", "sma_gap_20", "volatility_10", "rsi_14"]
TRADING_DAYS = 252


class Candle(BaseModel):
    date: str
    close: float = Field(gt=0)
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None


def build_frame(quotes: list[Candle], min_rows: int = 100) -> pd.DataFrame:
    frame = pd.DataFrame([q.model_dump() for q in quotes])
    if frame.empty or "date" not in frame or "close" not in frame:
        raise ValueError("No usable historical candles were supplied.")
    frame["date"] = pd.to_datetime(frame["date"], utc=True, errors="coerce")
    for col in ("close", "open", "high", "low", "volume"):
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    frame = frame.dropna(subset=["date", "close"])
    frame = (
        frame[frame["close"] > 0]
        .sort_values("date")
        .drop_duplicates("date", keep="last")
        .reset_index(drop=True)
    )
    if len(frame) < min_rows:
        raise ValueError(f"At least {min_rows} valid daily observations are needed. Try again later or choose another stock.")

    close = frame["close"].astype(float)
    returns = close.pct_change()
    frame["return_1"] = returns
    frame["momentum_5"] = close.pct_change(5)
    frame["momentum_10"] = close.pct_change(10)
    frame["sma_gap_10"] = close / close.rolling(10).mean() - 1
    frame["sma_gap_20"] = close / close.rolling(20).mean() - 1
    frame["volatility_10"] = returns.rolling(10).std(ddof=0)

    delta = close.diff()
    gains = delta.clip(lower=0).rolling(14).mean()
    losses = (-delta.clip(upper=0)).rolling(14).mean()
    rsi = 100 - 100 / (1 + gains / losses.replace(0, np.nan))
    # When there were no losses in the window RSI is 100 (or 50 if the price did not move at all).
    # Warm-up rows (first 13) stay NaN and are dropped later instead of being silently set to 50.
    no_loss = (losses == 0) & losses.notna()
    rsi = rsi.mask(no_loss & (gains > 0), 100.0).mask(no_loss & (gains == 0), 50.0)
    frame["rsi_14"] = rsi

    # Extra OHLCV-derived columns used by the CNN window features.
    high, low, open_, volume = frame["high"], frame["low"], frame["open"], frame["volume"]
    frame["hl_range"] = ((high - low) / close).fillna(0.0)
    frame["oc_return"] = ((close - open_) / open_.replace(0, np.nan)).fillna(0.0)
    vol_ratio = volume / volume.rolling(20, min_periods=5).mean().replace(0, np.nan)
    frame["vol_chg"] = np.log(vol_ratio.clip(lower=0.05, upper=20)).fillna(0.0)

    next_close = close.shift(-1)
    frame["next_return"] = next_close / close - 1
    frame["target"] = np.where(next_close.notna(), (next_close > close).astype(float), np.nan)
    return frame


def safe_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "accuracyPct": round(float(accuracy_score(y_true, y_pred) * 100), 2),
        "precisionPct": round(float(precision_score(y_true, y_pred, zero_division=0) * 100), 2),
        "recallPct": round(float(recall_score(y_true, y_pred, zero_division=0) * 100), 2),
        "f1Pct": round(float(f1_score(y_true, y_pred, zero_division=0) * 100), 2),
    }


def confusion(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, int]:
    y_true = np.asarray(y_true).astype(int)
    y_pred = np.asarray(y_pred).astype(int)
    return {
        "tp": int(np.sum((y_true == 1) & (y_pred == 1))),
        "fp": int(np.sum((y_true == 0) & (y_pred == 1))),
        "tn": int(np.sum((y_true == 0) & (y_pred == 0))),
        "fn": int(np.sum((y_true == 1) & (y_pred == 0))),
    }


def max_drawdown(returns) -> float:
    """Worst peak-to-trough fall of the compounded equity curve (a negative number or 0)."""
    equity = peak = 1.0
    worst = 0.0
    for value in returns:
        equity *= max(0.0, 1.0 + float(value))
        peak = max(peak, equity)
        if peak > 0:
            worst = min(worst, equity / peak - 1.0)
    return worst


def pct(value: float) -> float:
    return round(float(value) * 100, 2)


def money(value: float) -> float:
    return round(float(value), 2)


def significance_margin_pct(n: int) -> float:
    """Two standard errors of an accuracy estimate on n samples (worst case p=0.5), in percentage points.

    A model must beat the best naive baseline by more than this before we call the gap a real edge.
    """
    return 2 * float(np.sqrt(0.25 / max(n, 1))) * 100
