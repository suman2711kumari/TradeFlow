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
from .common import FEATURES, Candle, build_frame, confusion, safe_metrics

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
        "1D CNN": (cnn_pred, "Deep learning experiment"),
        "Logistic Regression": ((lr_prob >= 0.5).astype(int), "Classical baseline"),
        "Random Forest": ((rf_prob >= 0.5).astype(int), "Classical comparison"),
        "Majority class (training data)": (np.full(len(y_te), majority), "Naive baseline"),
        "Always predict up": (np.ones(len(y_te), dtype=int), "Naive baseline"),
    }
    models = [
        {"model": name, "role": role, **safe_metrics(y_te, prediction), "confusion": confusion(y_te, prediction)}
        for name, (prediction, role) in preds.items()
    ]

    cnn_acc = models[0]["accuracyPct"]
    best_other = max(m["accuracyPct"] for m in models[1:])
    best_baseline = max(m["accuracyPct"] for m in models[3:])
    verdict = (
        f"On this held-out test period, the CNN scored {cnn_acc:.1f}% accuracy. "
        f"The best alternative scored {best_other:.1f}% and the strongest simple baseline scored {best_baseline:.1f}%. "
        "This single-stock, single-period comparison is descriptive and does not establish a reliable predictive edge."
    )

    dates = frame["date"].to_numpy()
    te_t = t_idx[te]
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
        "verdict": verdict,
        "notes": [
            "Scaling statistics are computed on training windows only; early stopping uses a separate validation block; the test block is never used for fitting or model selection.",
            "All models are evaluated on the identical chronological test rows. Window features differ from the tabular features, but the labels and test dates match.",
            "A CNN is an experiment here. Daily price direction is very noisy, so a result near 50% is expected.",
        ],
    }


def run_live_cnn_prediction(payload: CnnRequest) -> dict[str, Any]:
    """Evaluate a CNN on a chronological holdout, then refit on labelled history for the latest session."""
    tf = _tf()
    frame = build_frame(payload.quotes, min_rows=300)
    X, y, _ = build_windows(frame)
    n = len(X)
    if n < 250:
        raise ValueError("Not enough history to build CNN windows. Need roughly 300+ sessions of daily data.")

    i_train, i_val = int(n * 0.6), int(n * 0.8)
    tr = slice(0, i_train - 1)
    va = slice(i_train, i_val - 1)
    te = slice(i_val, n)
    X_tr, y_tr = X[tr], y[tr]
    X_va, y_va = X[va], y[va]
    X_te, y_te = X[te], y[te]
    if len(y_tr) < 2 or len(y_va) < 2 or len(y_te) < 2 or len(np.unique(y_tr)) < 2:
        raise ValueError("Not enough balanced chronological samples for the CNN evaluation.")

    # The holdout model sees only the training block; validation selects the epoch.
    mean = X_tr.reshape(-1, X_tr.shape[-1]).mean(axis=0)
    std = X_tr.reshape(-1, X_tr.shape[-1]).std(axis=0) + 1e-8
    scale = lambda values: ((values - mean) / std).astype(np.float32)
    tf.keras.utils.set_random_seed(SEED)
    holdout_model = build_model(tf, X.shape[-1])
    history = holdout_model.fit(
        scale(X_tr), y_tr, validation_data=(scale(X_va), y_va),
        epochs=payload.epochs, batch_size=32, verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)],
    )
    holdout_prob = holdout_model.predict(scale(X_te), verbose=0).ravel()
    holdout_accuracy = float(np.mean((holdout_prob >= 0.5).astype(int) == y_te) * 100)
    best_epoch = max(1, int(np.argmin(history.history["val_loss"])) + 1)

    # Refit using all labelled windows. The final window has no label and is used only for inference.
    final_mean = X.reshape(-1, X.shape[-1]).mean(axis=0)
    final_std = X.reshape(-1, X.shape[-1]).std(axis=0) + 1e-8
    final_model = build_model(tf, X.shape[-1])
    tf.keras.utils.set_random_seed(SEED)
    final_model.fit(
        ((X - final_mean) / final_std).astype(np.float32), y,
        epochs=best_epoch, batch_size=32, verbose=0,
    )
    latest_features = frame[WINDOW_FEATURES].tail(WINDOW).to_numpy(dtype=np.float32)
    if latest_features.shape != (WINDOW, len(WINDOW_FEATURES)) or not np.isfinite(latest_features).all():
        raise ValueError("The latest 30-session feature window is incomplete.")
    latest_window = ((latest_features - final_mean) / final_std).astype(np.float32)[None, ...]
    probability_up = float(final_model.predict(latest_window, verbose=0).ravel()[0])
    return {
        "direction": "UP" if probability_up >= 0.5 else "NOT_UP",
        "probabilityUpPct": round(probability_up * 100, 2),
        "evaluationAccuracyPct": round(holdout_accuracy, 2),
        "evaluationLabel": "Chronological held-out test period",
        "baselineAccuracyPct": round(max(float(np.mean(y_te) * 100), float(np.mean(1 - y_te) * 100)), 2),
    }
