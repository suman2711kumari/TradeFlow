"""Moving-average crossover backtester (long-only) with transaction costs and a buy-and-hold benchmark."""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field, model_validator

from .common import TRADING_DAYS, Candle, build_frame, pct


class BacktestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=30)
    quotes: list[Candle]
    fastWindow: int = Field(default=20, ge=2, le=100)
    slowWindow: int = Field(default=50, ge=5, le=250)
    costBps: float = Field(default=10.0, ge=0, le=200, description="Cost per side in basis points (brokerage, charges, slippage).")
    initialCapital: float = Field(default=100_000.0, gt=0, le=1_000_000_000)

    @model_validator(mode="after")
    def _check_windows(self) -> "BacktestRequest":
        if self.fastWindow >= self.slowWindow:
            raise ValueError("The fast moving-average window must be shorter than the slow window.")
        return self


def _metrics(net: pd.Series, initial: float) -> dict[str, float]:
    equity = initial * (1 + net).cumprod()
    n = len(net)
    total = float(equity.iloc[-1] / initial - 1)
    cagr = float((equity.iloc[-1] / initial) ** (TRADING_DAYS / n) - 1) if n > 0 and equity.iloc[-1] > 0 else -1.0
    std = float(net.std(ddof=1)) if n > 1 else 0.0
    vol = std * np.sqrt(TRADING_DAYS)
    sharpe = float(net.mean() / std * np.sqrt(TRADING_DAYS)) if std > 0 else 0.0
    drawdown = equity / np.maximum.accumulate(equity.to_numpy()) - 1
    return {
        "totalReturnPct": pct(total), "cagrPct": pct(cagr), "annualizedVolatilityPct": pct(vol),
        "sharpe": round(sharpe, 2), "maxDrawdownPct": pct(float(drawdown.min())),
        "finalValue": round(float(equity.iloc[-1]), 2),
    }


def _simulate(ret: pd.Series, signal: pd.Series, cost: float):
    # Signal computed from closes up to day t-1 decides the position held over day t (no look-ahead).
    position = signal.shift(1).fillna(0.0)
    turnover = position.diff().abs()
    turnover.iloc[0] = position.iloc[0]
    net = position * ret - turnover * cost
    if position.iloc[-1] == 1:  # liquidate at the end so open trades pay their exit cost too
        net.iloc[-1] -= cost
        turnover.iloc[-1] += 1
    return position, turnover, net


def _trade_log(dates: pd.Series, position: pd.Series, net: pd.Series, cost: float) -> list[dict[str, Any]]:
    trades: list[dict[str, Any]] = []
    in_trade = False
    growth, entry = 1.0, None
    pos = position.to_numpy()
    n = net.to_numpy()
    for i in range(len(pos)):
        if pos[i] == 1 and not in_trade:
            in_trade, growth, entry = True, 1.0, dates.iloc[i]
        if in_trade:
            growth *= 1 + n[i]
            nxt = pos[i + 1] if i + 1 < len(pos) else 0.0
            if nxt == 0:  # exit happens at the close of day i; the exit cost lands on day i+1 in `net`
                exit_cost = cost if i + 1 < len(pos) else 0.0  # at the final bar the exit cost is already in `net`
                growth *= 1 - exit_cost
                trades.append({"entry": entry.strftime("%Y-%m-%d"), "exit": dates.iloc[i].strftime("%Y-%m-%d"), "returnPct": pct(growth - 1)})
                in_trade = False
    return trades


def run_backtest(payload: BacktestRequest) -> dict[str, Any]:
    frame = build_frame(payload.quotes, min_rows=payload.slowWindow + 60)
    close = frame["close"].astype(float)
    ret = close.pct_change()
    fast = close.rolling(payload.fastWindow).mean()
    slow = close.rolling(payload.slowWindow).mean()
    signal = (fast > slow).astype(float).where(slow.notna(), 0.0)

    start = int(slow.first_valid_index())  # evaluation starts once the slow average exists
    dates = frame["date"].iloc[start:].reset_index(drop=True)
    ret = ret.iloc[start:].reset_index(drop=True)
    signal = signal.iloc[start:].reset_index(drop=True)
    cost = payload.costBps / 10_000

    position, turnover, net = _simulate(ret, signal, cost)
    _, _, net_gross = _simulate(ret, signal, 0.0)
    bench_net = ret.copy()
    bench_net.iloc[0] -= cost  # buy-and-hold pays one entry cost

    initial = payload.initialCapital
    strat = _metrics(net, initial)
    gross = _metrics(net_gross, initial)
    bench = _metrics(bench_net, initial)
    equity_prev = (initial * (1 + net).cumprod()).shift(1).fillna(initial)
    total_costs = float((turnover * cost * equity_prev).sum())

    trades = _trade_log(dates, position, net, cost)
    wins = [t for t in trades if t["returnPct"] > 0]
    exposure = float(position.mean())

    equity_s = initial * (1 + net).cumprod()
    equity_b = initial * (1 + bench_net).cumprod()
    step = max(1, int(np.ceil(len(dates) / 300)))
    idx = list(range(0, len(dates), step))
    if idx[-1] != len(dates) - 1:
        idx.append(len(dates) - 1)
    curve = [{"date": dates.iloc[i].strftime("%Y-%m-%d"), "strategy": round(float(equity_s.iloc[i]), 2), "benchmark": round(float(equity_b.iloc[i]), 2)} for i in idx]

    warnings: list[str] = []
    if len(trades) < 10:
        warnings.append(f"Only {len(trades)} completed trade(s). That is too few to draw statistical conclusions; try a longer period or shorter windows.")
    if strat["totalReturnPct"] < bench["totalReturnPct"]:
        warnings.append("The strategy did not beat buy-and-hold over this period after costs. That is common for simple crossover rules.")
    if gross["totalReturnPct"] > strat["totalReturnPct"] + 2:
        warnings.append(f"Costs reduced the return by {gross['totalReturnPct'] - strat['totalReturnPct']:.1f} points.")

    return {
        "symbol": payload.symbol.upper(),
        "params": {"fastWindow": payload.fastWindow, "slowWindow": payload.slowWindow, "costBpsPerSide": payload.costBps, "initialCapital": initial},
        "period": {"start": dates.iloc[0].strftime("%Y-%m-%d"), "end": dates.iloc[-1].strftime("%Y-%m-%d"), "sessions": int(len(dates))},
        "strategy": {
            **strat, "grossReturnPct": gross["totalReturnPct"], "trades": len(trades),
            "winRatePct": pct(len(wins) / len(trades)) if trades else None,
            "avgTradeReturnPct": round(float(np.mean([t["returnPct"] for t in trades])), 2) if trades else None,
            "exposurePct": pct(exposure), "totalCostsInr": round(total_costs, 2),
        },
        "benchmark": {**bench, "description": "Buy and hold from the same start date (one entry cost, no exit)."},
        "recentTrades": trades[-12:],
        "equityCurve": curve,
        "warnings": warnings,
        "assumptions": [
            "Long-only. Signal: fast SMA above slow SMA, using closes up to the previous day (one-day delay, no look-ahead).",
            f"Costs of {payload.costBps:g} bps per side applied on every entry and exit; open trades are liquidated at the end.",
            "Executes at the closing price; ignores taxes, liquidity limits, and market impact. Historical results do not predict future returns.",
        ],
    }
