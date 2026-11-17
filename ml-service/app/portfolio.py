"""Current portfolio risk estimates based on historical individual-stock returns.

Historical stock data is used to estimate each holding's volatility, correlations and beta.
Current portfolio weights combine those statistics into a current risk estimate. The service
does not reconstruct or claim a historical account-level portfolio performance.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from .common import TRADING_DAYS

MIN_OBSERVATIONS = 60  # minimum overlapping daily returns needed for any statistic

SECTORS: dict[str, str] = {
    "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "KPITTECH": "IT", "QUICKHEAL": "IT",
    "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking", "AXISBANK": "Banking",
    "BAJFINANCE": "Financial services",
    "RELIANCE": "Energy & conglomerate", "ONGC": "Energy & conglomerate", "TATAPOWER": "Power",
    "ITC": "FMCG", "HINDUNILVR": "FMCG",
    "BHARTIARTL": "Telecom",
    "M&M": "Auto", "MARUTI": "Auto",
    "LT": "Infrastructure", "TITAN": "Consumer discretionary",
}


class PortfolioPosition(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    qty: float = Field(gt=0, le=1_000_000)
    avg: float = Field(gt=0, le=100_000_000)
    price: float = Field(gt=0, le=100_000_000)


class PricePoint(BaseModel):
    date: str
    close: float = Field(gt=0)


class PortfolioRiskRequest(BaseModel):
    positions: list[PortfolioPosition] = Field(max_length=200)
    histories: dict[str, list[PricePoint]] = Field(default_factory=dict)
    benchmark: list[PricePoint] | None = None
    shockPct: float = Field(default=-5.0, ge=-100, le=100)


def _to_series(points: list[PricePoint]) -> pd.Series:
    if not points:
        return pd.Series(dtype=float)
    idx = pd.to_datetime([p.date for p in points], utc=True, errors="coerce").tz_localize(None).normalize()
    series = pd.Series([p.close for p in points], index=idx, dtype=float)
    series = series[~series.index.isna()]
    series = series[~series.index.duplicated(keep="last")].sort_index()
    return series


def _drawdown(returns: pd.Series) -> tuple[float, str | None]:
    equity = (1 + returns).cumprod()
    dd = equity / equity.cummax() - 1
    if dd.empty:
        return 0.0, None
    return float(dd.min()), pd.Timestamp(dd.idxmin()).strftime("%Y-%m-%d")


def _r2(x: float) -> float:
    return round(float(x), 2)


def build_portfolio_risk(payload: PortfolioRiskRequest) -> dict[str, Any]:
    positions = payload.positions
    if not positions:
        raise ValueError("No holdings were supplied. Make a paper trade first.")

    warnings: list[str] = []
    rows: dict[str, dict[str, float]] = {}
    for p in positions:
        sym = p.name.upper()
        row = rows.setdefault(sym, {"qty": 0.0, "cost": 0.0, "value": 0.0})
        row["qty"] += p.qty
        row["cost"] += p.qty * p.avg
        row["value"] += p.qty * p.price
    total_value = sum(r["value"] for r in rows.values())
    total_cost = sum(r["cost"] for r in rows.values())
    if total_value <= 0:
        raise ValueError("Portfolio market value must be positive.")
    weights_all = {s: r["value"] / total_value for s, r in rows.items()}

    # ---- align histories --------------------------------------------------------------------------
    series: dict[str, pd.Series] = {}
    for sym in rows:
        hist = payload.histories.get(sym) or payload.histories.get(sym.lower()) or []
        s = _to_series(hist)
        if len(s) >= MIN_OBSERVATIONS + 1:
            series[sym] = s
        else:
            warnings.append(f"{sym}: only {len(s)} price observations available, so it is excluded from the statistics.")
    if not series:
        raise ValueError("Not enough historical price data for any holding to compute risk.")

    prices = pd.concat(series, axis=1, join="inner").dropna()
    returns = prices.pct_change().dropna()
    if len(returns) < MIN_OBSERVATIONS:
        raise ValueError("The holdings share too few overlapping trading days to compute reliable risk statistics.")
    covered = list(returns.columns)
    covered_value = sum(rows[s]["value"] for s in covered)
    coverage = covered_value / total_value
    if coverage < 0.999:
        warnings.append(f"Risk statistics cover {coverage * 100:.1f}% of portfolio value; the remainder lacked usable price history.")
    if len(returns) < 200:
        warnings.append(f"Only {len(returns)} overlapping daily returns were available (about a year is ideal). Treat the figures as rough.")

    w = np.array([rows[s]["value"] / covered_value for s in covered])  # today's weights, used for current risk attribution
    cov = returns.cov().to_numpy() * TRADING_DAYS
    sigma = np.sqrt(np.diag(cov))
    port_var = float(w @ cov @ w)
    port_vol = float(np.sqrt(max(port_var, 0.0)))
    marginal = cov @ w
    risk_contrib = (w * marginal / port_var) if port_var > 0 else np.zeros_like(w)  # sums to 1
    diversification_ratio = float((w @ sigma) / port_vol) if port_vol > 0 else 1.0

    # ---- correlations -----------------------------------------------------------------------------
    corr = returns.corr().fillna(0.0)
    pairs = []
    for i in range(len(covered)):
        for j in range(i + 1, len(covered)):
            pairs.append((covered[i], covered[j], float(corr.iloc[i, j])))
    avg_corr = float(np.mean([p[2] for p in pairs])) if pairs else None
    top_pairs = [{"a": a, "b": b, "correlation": round(c, 2)} for a, b, c in sorted(pairs, key=lambda x: -x[2])[:3]]

    # ---- betas vs benchmark -----------------------------------------------------------------------
    betas: dict[str, float | None] = {s: None for s in covered}
    benchmark_note = None
    if payload.benchmark:
        bench = _to_series(payload.benchmark).pct_change().dropna()
        joined = returns.join(bench.rename("__bench__"), how="inner").dropna()
        if len(joined) >= MIN_OBSERVATIONS and joined["__bench__"].var() > 0:
            var_b = float(joined["__bench__"].var())
            for s in covered:
                betas[s] = float(joined[s].cov(joined["__bench__"]) / var_b)
            benchmark_note = "NIFTY 50"
        else:
            warnings.append("Benchmark history overlapped too little with the holdings; betas are unavailable.")
    else:
        warnings.append("NIFTY 50 history was unavailable. Actual beta cannot be calculated; the market-fall tester will use the clearly labelled equal-fall scenario instead.")
    port_beta = None
    if all(b is not None for b in betas.values()):
        port_beta = float(sum(w[i] * betas[s] for i, s in enumerate(covered)))

    # ---- per-holding table ------------------------------------------------------------------------
    holdings = []
    for i, s in enumerate(covered):
        dd_i, _ = _drawdown(returns[s])
        holdings.append({
            "symbol": s,
            "sector": SECTORS.get(s, "Other"),
            "quantity": rows[s]["qty"],
            "marketValue": _r2(rows[s]["value"]),
            "weightPct": _r2(weights_all[s] * 100),
            "unrealizedPnl": _r2(rows[s]["value"] - rows[s]["cost"]),
            "annualizedVolatilityPct": _r2(sigma[i] * 100),
            "maxDrawdownPct": _r2(dd_i * 100),
            "beta": None if betas[s] is None else round(betas[s], 2),
            "riskContributionPct": _r2(risk_contrib[i] * 100),
            "windowReturnPct": _r2(((1 + returns[s]).prod() - 1) * 100),
        })
    for s in rows:
        if s not in covered:
            holdings.append({
                "symbol": s, "sector": SECTORS.get(s, "Other"), "quantity": rows[s]["qty"],
                "marketValue": _r2(rows[s]["value"]), "weightPct": _r2(weights_all[s] * 100),
                "unrealizedPnl": _r2(rows[s]["value"] - rows[s]["cost"]),
                "annualizedVolatilityPct": None, "maxDrawdownPct": None, "beta": None,
                "riskContributionPct": None, "windowReturnPct": None,
            })
    holdings.sort(key=lambda h: -h["marketValue"])

    # ---- concentration ----------------------------------------------------------------------------
    hhi = float(sum(v ** 2 for v in weights_all.values()))
    sector_w: dict[str, float] = {}
    for s, wt in weights_all.items():
        sector_w[SECTORS.get(s, "Other")] = sector_w.get(SECTORS.get(s, "Other"), 0.0) + wt
    sectors = [{"sector": k, "weightPct": _r2(v * 100)} for k, v in sorted(sector_w.items(), key=lambda kv: -kv[1])]

    flags: list[str] = []
    top = holdings[0]
    if top["weightPct"] >= 40 and len(rows) > 1:
        flags.append(f"{top['symbol']} makes up {top['weightPct']:.0f}% of your money. If it falls sharply, your whole portfolio is hit hard.")
    if len(rows) == 1:
        flags.append("You own only one stock, so all your money rides on it. Owning several different stocks spreads the risk.")
    if sectors[0]["weightPct"] >= 50 and len(rows) > 1:
        flags.append(f"{sectors[0]['weightPct']:.0f}% of your money is in one sector ({sectors[0]['sector']}). Stocks in the same sector often fall together.")
    if avg_corr is not None and avg_corr >= 0.6:
        flags.append(f"Your stocks tend to move together (average correlation {avg_corr:.2f}), so owning several of them protects you less than it seems.")
    for h in holdings:
        rc = h["riskContributionPct"]
        if rc is not None and len(rows) > 1 and rc >= 1.5 * h["weightPct"] and rc >= 25:
            flags.append(f"{h['symbol']} is {h['weightPct']:.0f}% of your money but causes {rc:.0f}% of your portfolio's ups and downs.")

    # ---- stress tests -----------------------------------------------------------------------------
    shock = float(payload.shockPct)
    uniform_change = total_value * shock / 100
    per_holding = []
    beta_change = 0.0
    assumed = []
    for h in holdings:
        b = betas.get(h["symbol"])
        if b is None:
            # Never invent a measured beta of 1 when benchmark data is absent.
            assumed.append(h["symbol"])
            per_holding.append({
                "symbol": h["symbol"], "betaUsed": None,
                "estimatedMovePct": None, "estimatedValueChange": None,
            })
            continue
        move = max(-100.0, b * shock)
        change = h["marketValue"] * move / 100
        beta_change += change
        per_holding.append({"symbol": h["symbol"], "betaUsed": round(b, 2), "estimatedMovePct": _r2(move), "estimatedValueChange": _r2(change)})
    has_complete_beta = not assumed
    if not has_complete_beta:
        warnings.append(
            "Beta-adjusted market-fall result is unavailable because beta could not be measured for: "
            + ", ".join(assumed) + ". The equal-fall scenario is still available."
        )


    return {
        "asOf": returns.index[-1].strftime("%Y-%m-%d"),
        "window": {
            "start": returns.index[0].strftime("%Y-%m-%d"),
            "end": returns.index[-1].strftime("%Y-%m-%d"),
            "observations": int(len(returns)),
            "coveragePct": _r2(coverage * 100),
        },
        "summary": {
            "positionsCount": len(rows),
            "marketValue": _r2(total_value),
            "costValue": _r2(total_cost),
            "unrealizedPnl": _r2(total_value - total_cost),
            "unrealizedPnlPct": _r2((total_value - total_cost) / total_cost * 100) if total_cost else 0.0,
            "annualizedVolatilityPct": _r2(port_vol * 100),
            "beta": None if port_beta is None else round(port_beta, 2),
            "betaBenchmark": benchmark_note,
            "diversificationRatio": round(diversification_ratio, 2),
            "averagePairwiseCorrelation": None if avg_corr is None else round(avg_corr, 2),
            "effectiveNumberOfStocks": round(1 / hhi, 2),
            "concentrationIndexPct": _r2(hhi * 100),
            "largestHolding": top["symbol"],
            "largestHoldingWeightPct": top["weightPct"],
        },
        "holdings": holdings,
        "sectors": sectors,
        "correlation": {"labels": covered, "matrix": [[round(float(v), 2) for v in row] for row in corr.to_numpy()], "highestPairs": top_pairs},
        "flags": flags,
        "stress": stress,
        "warnings": warnings,
        "methodology": (
            "Historical daily prices are used to estimate each stock's volatility, correlations and beta. Current portfolio weights are then "
            "combined with the historical covariance matrix to estimate the risk of the portfolio as it is held today. Risk contribution reflects "
            "each holding's contribution to estimated current portfolio variance. These are historical-data-based risk estimates, not a reconstruction "
            "of the user's past account performance or a prediction of future returns."
        ),
    }
