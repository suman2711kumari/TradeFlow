"""Stock analysis with expanding-window walk-forward validation.

Why walk-forward instead of one 80/20 split: a single split gives one noisy accuracy number from one
market regime. Walk-forward trains on the past only, tests on the next block, then rolls forward, so we get
several out-of-sample estimates and can see how unstable they are.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .common import (
    FEATURES,
    TRADING_DAYS,
    Candle,
    build_frame,
    confusion,
    max_drawdown,
    money,
    pct,
    safe_metrics,
    significance_margin_pct,
)

SIGNAL_THRESHOLD = 0.55
DEFAULT_COST_BPS = 10.0  # per side; a rough all-in figure for brokerage + statutory charges + slippage


class AnalysisRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    quotes: list[Candle]


def make_logistic() -> Pipeline:
    return Pipeline([
        ("scale", StandardScaler()),  # fitted on the training rows of each fold only
        ("model", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42)),
    ])


def make_forest() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=300, max_depth=5, min_samples_leaf=5,
        class_weight="balanced_subsample", random_state=42, n_jobs=-1,
    )


def prob_up(model, x: pd.DataFrame) -> np.ndarray:
    classes = list(model.classes_)
    if 1 not in classes:
        return np.zeros(len(x))
    return model.predict_proba(x)[:, classes.index(1)]


def walk_forward_splits(n: int, n_splits: int = 5, initial_frac: float = 0.4, gap: int = 1):
    """Yield (train_idx_end, test_start, test_end) as positional bounds. Train = [0, train_end)."""
    initial = int(n * initial_frac)
    fold = (n - initial) // n_splits
    if fold < 20:
        raise ValueError("Not enough history for walk-forward validation. Need more daily observations.")
    for k in range(n_splits):
        test_start = initial + k * fold
        test_end = n if k == n_splits - 1 else test_start + fold
        yield max(0, test_start - gap), test_start, test_end


def run_walk_forward(usable: pd.DataFrame, n_splits: int = 5, gap: int = 1) -> dict[str, Any]:
    n = len(usable)
    folds: list[dict[str, Any]] = []
    pooled: dict[str, dict[str, list]] = {k: {"y": [], "pred": [], "prob": []} for k in ("lr", "rf", "majority", "always_up")}
    pooled_meta: list[pd.DataFrame] = []

    for number, (train_end, test_start, test_end) in enumerate(walk_forward_splits(n, n_splits, gap=gap), start=1):
        train, test = usable.iloc[:train_end], usable.iloc[test_start:test_end]
        y_train = train["target"].astype(int).to_numpy()
        y_test = test["target"].astype(int).to_numpy()
        if len(train) < 100 or len(np.unique(y_train)) < 2:
            raise ValueError("A training fold has too little data or only one class.")
        # Safety net: a test row must always be strictly later than every training row.
        assert train["date"].max() < test["date"].min()

        lr = make_logistic().fit(train[FEATURES], y_train)
        lr_prob = prob_up(lr, test[FEATURES])
        rf = make_forest().fit(train[FEATURES], y_train)
        rf_prob = prob_up(rf, test[FEATURES])
        majority_class = int(np.mean(y_train) >= 0.5)  # most frequent class in the TRAINING data only

        preds = {
            "lr": (lr_prob >= 0.5).astype(int),
            "rf": (rf_prob >= 0.5).astype(int),
            "majority": np.full(len(test), majority_class),
            "always_up": np.ones(len(test), dtype=int),
        }
        probs = {"lr": lr_prob, "rf": rf_prob, "majority": np.full(len(test), float(majority_class)), "always_up": np.ones(len(test))}
        for key in pooled:
            pooled[key]["y"].extend(y_test.tolist())
            pooled[key]["pred"].extend(preds[key].tolist())
            pooled[key]["prob"].extend(probs[key].tolist())
        pooled_meta.append(pd.DataFrame({"date": test["date"].to_numpy(), "next_return": test["next_return"].to_numpy(), "lr_prob": lr_prob}))

        folds.append({
            "fold": number,
            "trainStart": train["date"].iloc[0].strftime("%Y-%m-%d"),
            "trainEnd": train["date"].iloc[-1].strftime("%Y-%m-%d"),
            "testStart": test["date"].iloc[0].strftime("%Y-%m-%d"),
            "testEnd": test["date"].iloc[-1].strftime("%Y-%m-%d"),
            "trainSize": int(len(train)),
            "testSize": int(len(test)),
            "accuracyPct": {
                "logisticRegression": safe_metrics(y_test, preds["lr"])["accuracyPct"],
                "randomForest": safe_metrics(y_test, preds["rf"])["accuracyPct"],
                "majorityBaseline": safe_metrics(y_test, preds["majority"])["accuracyPct"],
                "alwaysUp": safe_metrics(y_test, preds["always_up"])["accuracyPct"],
            },
        })

    def fold_accuracies(key: str) -> list[float]:
        names = {"lr": "logisticRegression", "rf": "randomForest", "majority": "majorityBaseline", "always_up": "alwaysUp"}
        return [f["accuracyPct"][names[key]] for f in folds]

    labels = {
        "lr": ("Logistic Regression", "Primary model"),
        "rf": ("Random Forest", "Comparison model"),
        "majority": ("Majority class (training data)", "Baseline"),
        "always_up": ("Always predict up", "Baseline"),
    }
    summary = []
    for key, (label, role) in labels.items():
        y = np.asarray(pooled[key]["y"])
        p = np.asarray(pooled[key]["pred"])
        accs = fold_accuracies(key)
        summary.append({
            "model": label, "role": role,
            **safe_metrics(y, p),
            "meanFoldAccuracyPct": round(float(np.mean(accs)), 2),
            "stdFoldAccuracyPct": round(float(np.std(accs, ddof=0)), 2),
            "confusion": confusion(y, p),
        })

    meta = pd.concat(pooled_meta, ignore_index=True)
    return {
        "method": "Expanding-window walk-forward validation",
        "nSplits": len(folds),
        "gapSessions": gap,
        "pooledSessions": int(len(meta)),
        "folds": folds,
        "summary": summary,
        "_pooled": meta,  # internal, removed before returning to the client
    }


def backtest_signal(meta: pd.DataFrame, threshold: float = SIGNAL_THRESHOLD, cost_bps: float = DEFAULT_COST_BPS) -> dict[str, Any]:
    """Long-only strategy on out-of-sample predictions: hold when P(up) >= threshold, otherwise cash."""
    returns = meta["next_return"].to_numpy(dtype=float)
    # A signal observed at the close of day t is used only after a full session delay.
    # This avoids assuming that we can trade at the same close used to create the features.
    signals = (meta["lr_prob"].to_numpy(dtype=float) >= threshold).astype(float)
    position = np.concatenate([[0.0], signals[:-1]])
    turnover = np.abs(np.diff(np.concatenate([[0.0], position, [0.0]])))  # includes the final exit
    cost = cost_bps / 10_000
    gross = position * returns
    net = gross - turnover[:-1] * cost
    net[-1] -= turnover[-1] * cost
    trades = int(np.sum((position == 1) & (np.concatenate([[0.0], position[:-1]]) == 0)))
    return {
        "strategyReturnPct": pct(np.prod(1 + net) - 1),
        "strategyGrossReturnPct": pct(np.prod(1 + gross) - 1),
        "buyAndHoldReturnPct": pct(np.prod(1 + returns) - 1),
        "strategyMaxDrawdownPct": pct(max_drawdown(net)),
        "buyAndHoldMaxDrawdownPct": pct(max_drawdown(returns)),
        "trades": trades,
        "costBpsPerSide": cost_bps,
        "testSessions": int(len(meta)),
        "rule": (
            f"Out-of-sample walk-forward predictions only. Long when Logistic Regression P(up) >= {int(threshold * 100)}%, otherwise cash. "
            f"Includes {cost_bps:g} bps per side for costs and slippage. Delays the signal by one session; simplified close-to-close fills (no market impact)."
        ),
    }


def analyze(payload: AnalysisRequest) -> dict[str, Any]:
    frame = build_frame(payload.quotes)
    usable = frame.dropna(subset=FEATURES + ["target", "next_return"]).reset_index(drop=True)
    if len(usable) < 200:
        raise ValueError("At least about 200 complete feature rows are needed for walk-forward validation.")

    wf = run_walk_forward(usable)
    meta = wf.pop("_pooled")
    backtest = backtest_signal(meta)

    by_model = {row["model"]: row for row in wf["summary"]}
    lr_acc = by_model["Logistic Regression"]["accuracyPct"]
    rf_acc = by_model["Random Forest"]["accuracyPct"]
    best_baseline = max(by_model["Majority class (training data)"]["accuracyPct"], by_model["Always predict up"]["accuracyPct"])
    best_model_name, best_model_acc = ("Logistic Regression", lr_acc) if lr_acc >= rf_acc else ("Random Forest", rf_acc)
    edge = best_model_acc - best_baseline
    margin = significance_margin_pct(wf["pooledSessions"])
    if edge > margin:
        assessment = (
            f"{best_model_name} beat the best naive baseline by {edge:.1f} points out of sample (noise margin is about {margin:.1f}). "
            "Picking the better of two models on the same data flatters it, and small edges rarely survive trading costs."
        )
    else:
        assessment = (
            f"No demonstrated edge: the best model ({best_model_name}, {best_model_acc:.1f}%) is within about {margin:.1f} points of a naive baseline "
            f"({best_baseline:.1f}%), which is inside the noise for {wf['pooledSessions']} test sessions. Treat the probability below as noise, not a signal."
        )

    # Final model: refit on every labelled row, predict the latest (still unlabelled) session.
    labelled = frame.dropna(subset=FEATURES + ["target"])
    latest_rows = frame.dropna(subset=FEATURES)
    if labelled["target"].nunique() < 2 or latest_rows.empty:
        raise ValueError("Unable to fit a final model from the available historical observations.")
    final_lr = make_logistic().fit(labelled[FEATURES], labelled["target"].astype(int).to_numpy())
    probability_up = float(prob_up(final_lr, latest_rows.iloc[[-1]][FEATURES])[0])

    close = frame["close"].astype(float)
    latest_close, previous_close = float(close.iloc[-1]), float(close.iloc[-2])
    sma10, sma20 = float(close.tail(10).mean()), float(close.tail(20).mean())
    recent_returns = close.pct_change().dropna().tail(90).to_numpy(dtype=float)
    daily_vol = float(np.std(recent_returns, ddof=0)) if len(recent_returns) else 0.0
    one_year = close.tail(TRADING_DAYS + 1)
    year_return = float(one_year.iloc[-1] / one_year.iloc[0] - 1) if len(one_year) > 1 else 0.0
    trend = "Upward" if latest_close > sma10 > sma20 else "Downward" if latest_close < sma10 < sma20 else "Mixed"
    signal = "Bullish bias" if probability_up >= 0.58 else "Bearish bias" if probability_up <= 0.42 else "No strong edge"
    momentum5 = float(frame["momentum_5"].iloc[-1])
    ann_vol = daily_vol * np.sqrt(TRADING_DAYS)

    notes = [
        "Latest close is above its 20-session average." if latest_close > sma20 else "Latest close is below its 20-session average.",
        "Five-session momentum is positive." if momentum5 >= 0 else "Five-session momentum is negative.",
        "Recent realized volatility is elevated; position sizing deserves extra care." if ann_vol >= 0.35 else "Recent realized volatility is comparatively moderate.",
        f"Walk-forward validation: {wf['nSplits']} expanding-window folds, {wf['pooledSessions']} out-of-sample sessions, no shuffling and a {wf['gapSessions']}-session gap between training and test data.",
    ]
    # A beginner-friendly, model-informed next-session *illustration*, not a
    # validated numerical price forecast. The classifier predicts direction;
    # the possible size of a move is taken from the last 90 daily returns.
    # We show the recent one-standard-deviation band, not a confidence interval.
    recent = close.pct_change().dropna().tail(90)
    up_days = recent[recent > 0]
    other_days = recent[recent <= 0]
    expected_move = (
        probability_up * float(up_days.mean() if len(up_days) else 0.0)
        + (1.0 - probability_up) * float(other_days.mean() if len(other_days) else 0.0)
    )
    daily_spread = float(recent.std(ddof=0)) if len(recent) > 1 else 0.0
    estimated_close = max(0.0, latest_close * (1.0 + expected_move))
    lower_close = max(0.0, latest_close * (1.0 + expected_move - daily_spread))
    upper_close = max(lower_close, latest_close * (1.0 + expected_move + daily_spread))
    chart_frame = frame.tail(120)
    return {
        "symbol": payload.symbol.upper(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "dataSource": "Yahoo Finance daily candles supplied by the Node.js backend",
        "dataPoints": int(len(frame)),
        "latest": {
            "price": money(latest_close), "previousClose": money(previous_close),
            "dailyChange": money(latest_close - previous_close),
            "dailyChangePct": pct(latest_close / previous_close - 1) if previous_close else 0,
            "oneYearReturnPct": pct(year_return), "sma10": money(sma10), "sma20": money(sma20), "trend": trend,
            "annualizedVolatilityPct": pct(ann_vol), "maxDrawdownPct": pct(max_drawdown(recent_returns.tolist())),
        },
        "prediction": {
            "direction": signal,
            "probabilityUpPct": pct(probability_up), "probabilityDownPct": pct(1 - probability_up),
            "model": "scikit-learn Logistic Regression (refit on all labelled history)",
            "walkForwardAccuracyPct": lr_acc,
            "majorityBaselineAccuracyPct": by_model["Majority class (training data)"]["accuracyPct"],
            "alwaysUpAccuracyPct": by_model["Always predict up"]["accuracyPct"],
            "edgeAssessment": assessment,
            "thresholdPct": int(SIGNAL_THRESHOLD * 100),
            "disclaimer": "Experimental estimate, not investment advice. Probabilities are not calibrated and short-term returns are very noisy.",
        },
        "priceOutlook": {
            "horizon": "Next trading session",
            "lastHistoricalClose": money(latest_close),
            "lastHistoricalDate": frame["date"].iloc[-1].strftime("%Y-%m-%d"),
            "illustrativePrice": money(estimated_close),
            "lowerIllustration": money(lower_close),
            "upperIllustration": money(upper_close),
            "historicalDailyMovePct": pct(daily_spread),
            "expectedMovePct": pct(expected_move),
            "method": "Logistic Regression next-session UP probability combined with average size of recent UP and non-UP daily moves (last 90 sessions).",
            "warning": "Illustration only. The direction model is not calibrated and may not beat a basic guess; this is not a reliable future price forecast. The band is one recent daily standard deviation, not a confidence interval. Based on the last available historical close, not a guaranteed executable quote."
        },
        "walkForward": wf,
        "modelComparison": wf["summary"],
        "backtest": backtest,
        "chart": [{"date": row.date.strftime("%Y-%m-%d"), "close": money(row.close)} for row in chart_frame.itertuples(index=False)],
        "researchNotes": notes,
    }
