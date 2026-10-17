"""1D CNN experiment.

Each sample is a window of the last WINDOW trading sessions x a handful of OHLCV-derived features. Convolution
layers learn local temporal patterns, max-pooling shrinks the sequence, and dense layers classify whether the next
session closes higher. The CNN is compared with Logistic Regression, Random Forest and naive baselines on EXACTLY
the same chronological test rows. It is an experiment, not a claim that a CNN predicts markets.
"""
from __future__ import annotations

import os
from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from .analysis import make_forest, make_logistic, prob_up
from .common import FEATURES, Candle, build_frame, confusion, safe_metrics, significance_margin_pct

WINDOW = 30
WINDOW_FEATURES = ["return_1", "hl_range", "oc_return", "vol_chg", "sma_gap_10", "volatility_10"]
SEED = 42


class CnnUnavailable(RuntimeError):
    """Raised when TensorFlow is not installed in this environment."""


class CnnRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    quotes: list[Candle]
    epochs: int = Field(default=60, ge=5, le=150)


def _tf():
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    try:
        import tensorflow as tf  # noqa: WPS433 (lazy import: TensorFlow is optional and slow to import)
    except Exception as exc:  # ImportError or a broken native install
        raise CnnUnavailable(
            "TensorFlow is not installed in the Python environment. Run: pip install -r requirements-cnn.txt, then restart the ML service."
        ) from exc
    return tf


def build_windows(frame: pd.DataFrame, window: int = WINDOW):
    """Return (X, y, t_index) where X[i] is the window ending at row t_index[i] and y[i] the next-session direction."""
    feats = frame[WINDOW_FEATURES].to_numpy(dtype=float)
    valid = ~np.isnan(feats).any(axis=1)
    first = int(np.argmax(valid)) if valid.any() else len(frame)
    xs, ys, ts = [], [], []
    target = frame["target"].to_numpy(dtype=float)
    for t in range(first + window - 1, len(frame) - 1):  # the last row has no label yet
        if np.isnan(target[t]):
            continue
        xs.append(feats[t - window + 1: t + 1])
        ys.append(int(target[t]))
        ts.append(t)
    return np.asarray(xs, dtype=np.float32), np.asarray(ys, dtype=np.int32), np.asarray(ts)


def build_model(tf, n_features: int):
    keras = tf.keras
    layers = keras.layers
    model = keras.Sequential([
        keras.Input(shape=(WINDOW, n_features), name="window"),
        layers.Conv1D(16, kernel_size=3, activation="relu", padding="same", name="conv1"),
        layers.MaxPooling1D(pool_size=2, name="pool1"),
        layers.Conv1D(32, kernel_size=3, activation="relu", padding="same", name="conv2"),
        layers.MaxPooling1D(pool_size=2, name="pool2"),
        layers.GlobalAveragePooling1D(name="global_pool"),
        layers.Dropout(0.3, name="dropout"),
        layers.Dense(16, activation="relu", name="dense"),
        layers.Dense(1, activation="sigmoid", name="p_up"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="binary_crossentropy", metrics=["accuracy"])
    return model


def run_cnn_comparison(payload: CnnRequest) -> dict[str, Any]:
    tf = _tf()
    frame = build_frame(payload.quotes, min_rows=300)
    X, y, t_idx = build_windows(frame)
    n = len(X)
    if n < 250:
        raise ValueError("Not enough history to build CNN windows. Need roughly 300+ sessions of daily data.")

    # Chronological 60/20/20 split with a one-sample purge between blocks (labels look one session ahead).
    i_train, i_val = int(n * 0.6), int(n * 0.8)
    tr = slice(0, i_train - 1)
    va = slice(i_train, i_val - 1)
    te = slice(i_val, n)
    X_tr, y_tr, X_va, y_va, X_te, y_te = X[tr], y[tr], X[va], y[va], X[te], y[te]
    if len(np.unique(y_tr)) < 2:
        raise ValueError("Training window contains only one class.")

    # Scaling statistics come from the training windows ONLY.
    mean = X_tr.reshape(-1, X_tr.shape[-1]).mean(axis=0)
    std = X_tr.reshape(-1, X_tr.shape[-1]).std(axis=0) + 1e-8
    scale = lambda a: ((a - mean) / std).astype(np.float32)  # noqa: E731
    X_tr_s, X_va_s, X_te_s = scale(X_tr), scale(X_va), scale(X_te)

    tf.keras.utils.set_random_seed(SEED)
    model = build_model(tf, X.shape[-1])
    callbacks = [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)]
    history = model.fit(X_tr_s, y_tr, validation_data=(X_va_s, y_va), epochs=payload.epochs, batch_size=32, verbose=0, callbacks=callbacks)
    cnn_prob = model.predict(X_te_s, verbose=0).ravel()
    cnn_pred = (cnn_prob >= 0.5).astype(int)

    # Classical models: same rows, flat tabular features at the window's last day, trained on the same training block.
    flat = frame.loc[t_idx, FEATURES].reset_index(drop=True)
    lr = make_logistic().fit(flat.iloc[tr], y_tr)
    rf = make_forest().fit(flat.iloc[tr], y_tr)
    lr_prob, rf_prob = prob_up(lr, flat.iloc[te]), prob_up(rf, flat.iloc[te])
    majority = int(np.mean(y_tr) >= 0.5)

    preds = {
        "1D CNN": (cnn_pred, cnn_prob, "Deep learning experiment"),
        "Logistic Regression": ((lr_prob >= 0.5).astype(int), lr_prob, "Classical baseline"),
        "Random Forest": ((rf_prob >= 0.5).astype(int), rf_prob, "Classical comparison"),
        "Majority class (training data)": (np.full(len(y_te), majority), None, "Naive baseline"),
        "Always predict up": (np.ones(len(y_te), dtype=int), None, "Naive baseline"),
    }
    models = [{"model": name, "role": role, **safe_metrics(y_te, p), "confusion": confusion(y_te, p)} for name, (p, _, role) in preds.items()]

    cnn_acc = models[0]["accuracyPct"]
    best_other = max(m["accuracyPct"] for m in models[1:])
    best_baseline = max(m["accuracyPct"] for m in models[3:])
    margin = significance_margin_pct(len(y_te))
    if cnn_acc >= best_other + margin:
        verdict = (f"On this test window the CNN scored {cnn_acc:.1f}% vs {best_other:.1f}% for the best alternative, a gap larger than the noise margin "
                   f"(about {margin:.1f} points). One window and one stock is still weak evidence; repeat across stocks and periods.")
    elif cnn_acc <= best_baseline - margin:
        verdict = f"The CNN ({cnn_acc:.1f}%) did clearly worse than a naive baseline ({best_baseline:.1f}%). That is a typical, honest result for daily price data."
    else:
        verdict = (f"The CNN ({cnn_acc:.1f}%) was statistically indistinguishable from the simpler models and baselines ({best_other:.1f}% best); "
                   f"differences under about {margin:.1f} points are noise for {len(y_te)} test sessions. The extra complexity bought no demonstrated advantage.")

    dates = frame["date"].to_numpy()
    te_t = t_idx[te]
    table = [
        {"date": pd.Timestamp(dates[t]).strftime("%Y-%m-%d"), "actualUp": int(a), "cnnProbUpPct": round(float(c) * 100, 1),
         "logisticProbUpPct": round(float(l) * 100, 1), "forestProbUpPct": round(float(r) * 100, 1)}
        for t, a, c, l, r in list(zip(te_t, y_te, cnn_prob, lr_prob, rf_prob))[-15:]
    ]

    architecture = []
    for layer in model.layers:
        shape = getattr(layer, "output", None)
        architecture.append({
            "layer": layer.name, "type": layer.__class__.__name__,
            "outputShape": str(tuple(shape.shape)).replace("None", "batch") if shape is not None else "",
            "params": int(layer.count_params()),
        })
    hist = history.history
    best_epoch = int(np.argmin(hist["val_loss"])) + 1
    return {
        "symbol": payload.symbol.upper(),
        "window": WINDOW,
        "features": WINDOW_FEATURES,
        "split": {
            "trainSamples": int(len(y_tr)), "validationSamples": int(len(y_va)), "testSamples": int(len(y_te)),
            "testStart": pd.Timestamp(dates[te_t[0]]).strftime("%Y-%m-%d"), "testEnd": pd.Timestamp(dates[te_t[-1]]).strftime("%Y-%m-%d"),
        },
        "models": models,
        "architecture": architecture,
        "totalParams": int(model.count_params()),
        "training": {
            "epochsRun": len(hist["loss"]), "bestEpoch": best_epoch,
            "loss": [round(float(v), 4) for v in hist["loss"]],
            "valLoss": [round(float(v), 4) for v in hist["val_loss"]],
        },
        "predictions": table,
        "verdict": verdict,
        "notes": [
            "Scaling statistics are computed on training windows only; early stopping uses a separate validation block; the test block is never used for fitting or model selection.",
            "All models are evaluated on the identical chronological test rows. Window features differ from the tabular features, but the labels and test dates match.",
            "A CNN is an experiment here. Daily price direction is very noisy, so a result near 50% is expected.",
        ],
    }
