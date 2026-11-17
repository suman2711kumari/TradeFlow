"""Portfolio risk estimates for the user's current holdings.

Daily stock returns are combined using the portfolio's current market-value weights.
This estimates the risk of today's allocation under historical market movements; it
does not reconstruct the user's actual historical account performance.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from .common import TRADING_DAYS

MIN_OBSERVATIONS = 60

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
    values = pd.Series([p.close for p in points], index=idx, dtype=float)
    values = values[~values.index.isna()]
    return values[~values.index.duplicated(keep="last")].sort_index()

def _max_drawdown(returns: pd.Series) -> float:
    wealth = (1.0 + returns).cumprod()
    drawdown = wealth / wealth.cummax() - 1.0
    return float(drawdown.min()) if not drawdown.empty else 0.0

def _historical_var(returns: pd.Series) -> tuple[float, float]:
    """One-day 95% historical VaR and expected shortfall, expressed as loss percentages."""
    cutoff = float(returns.quantile(0.05))
    tail = returns[returns <= cutoff]
    return -cutoff * 100, -float(tail.mean()) * 100

def _stress_result(value: float, shock: float) -> dict[str, float]:
    change = value * shock / 100.0
    return {"shockPct": round(shock, 2), "estimatedValueChange": round(change, 2),
            "estimatedRemainingValue": round(max(0.0, value + change), 2)}

def build_portfolio_risk(payload: PortfolioRiskRequest) -> dict[str, Any]:
    if not payload.positions:
        raise ValueError("No holdings were supplied. Make a paper trade first.")

    rows: dict[str, dict[str, float]] = {}
    for position in payload.positions:
        symbol = position.name.upper()
        row = rows.setdefault(symbol, {"qty": 0.0, "cost": 0.0, "value": 0.0})
        row["qty"] += position.qty
        row["cost"] += position.qty * position.avg
        row["value"] += position.qty * position.price

    total_value = sum(row["value"] for row in rows.values())
    total_cost = sum(row["cost"] for row in rows.values())
    if total_value <= 0 or total_cost <= 0:
        raise ValueError("Portfolio market value and cost must be positive.")
    weights_all = {symbol: row["value"] / total_value for symbol, row in rows.items()}

    warnings: list[str] = []
    price_series: dict[str, pd.Series] = {}
    for symbol in rows:
        points = payload.histories.get(symbol) or payload.histories.get(symbol.lower()) or []
        series = _to_series(points)
        if len(series) >= MIN_OBSERVATIONS + 1:
            price_series[symbol] = series
        else:
            warnings.append(f"{symbol}: only {len(series)} valid price observations; excluded from risk statistics.")

    if not price_series:
        raise ValueError("Not enough historical price data for any holding to compute risk.")

    prices = pd.concat(price_series, axis=1, join="inner").dropna()
    stock_returns = prices.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    if len(stock_returns) < MIN_OBSERVATIONS:
        raise ValueError("Holdings share too few overlapping trading days to estimate portfolio risk.")

    covered = list(stock_returns.columns)
    covered_value = sum(rows[symbol]["value"] for symbol in covered)
    coverage = covered_value / total_value
    if coverage < 0.999:
        warnings.append(f"Risk statistics cover {coverage * 100:.1f}% of portfolio value; the rest lacks sufficient history.")
    if len(stock_returns) < 200:
        warnings.append(f"Only {len(stock_returns)} overlapping daily returns are available; estimates may be less stable.")

    # Renormalise only the holdings with sufficient history. These weights represent today's allocation.
    weights = pd.Series({symbol: rows[symbol]["value"] / covered_value for symbol in covered})
    weighted_returns = stock_returns[covered].mul(weights, axis=1).sum(axis=1)
    covariance = stock_returns.cov().to_numpy() * TRADING_DAYS
    weight_array = weights.to_numpy()
    portfolio_variance = float(weight_array @ covariance @ weight_array)
    portfolio_volatility = float(np.sqrt(max(portfolio_variance, 0.0)))
    individual_volatility = np.sqrt(np.diag(covariance))
    marginal_risk = covariance @ weight_array
    contributions = (weight_array * marginal_risk / portfolio_variance
                     if portfolio_variance > 0 else np.zeros_like(weight_array))
    diversification_ratio = (float(weight_array @ individual_volatility / portfolio_volatility)
                              if portfolio_volatility > 0 else 1.0)

    correlation = stock_returns[covered].corr().fillna(0.0)
    pairs = [(covered[i], covered[j], float(correlation.iloc[i, j]))
             for i in range(len(covered)) for j in range(i + 1, len(covered))]
    highest_pairs = [{"a": a, "b": b, "correlation": round(value, 2)}
                     for a, b, value in sorted(pairs, key=lambda item: -item[2])[:3]]
    average_correlation = float(np.mean([item[2] for item in pairs])) if pairs else None

    # Beta is estimated against the aligned NIFTY 50 return series.
    betas: dict[str, float | None] = {symbol: None for symbol in covered}
    benchmark_name = None
    if payload.benchmark:
        benchmark_returns = _to_series(payload.benchmark).pct_change().rename("benchmark")
        aligned = stock_returns[covered].join(benchmark_returns, how="inner").dropna()
        benchmark_variance = float(aligned["benchmark"].var()) if len(aligned) else 0.0
        if len(aligned) >= MIN_OBSERVATIONS and benchmark_variance > 0:
            for symbol in covered:
                betas[symbol] = float(aligned[symbol].cov(aligned["benchmark"]) / benchmark_variance)
            benchmark_name = "NIFTY 50"
        else:
            warnings.append("NIFTY 50 history did not overlap enough with the holdings; beta is unavailable.")
    else:
        warnings.append("NIFTY 50 history is unavailable; beta-adjusted scenario is not shown.")

    portfolio_beta = (sum(weights[symbol] * betas[symbol] for symbol in covered)
                      if all(betas[symbol] is not None for symbol in covered) else None)

    var95, expected_shortfall95 = _historical_var(weighted_returns)
    max_drawdown = _max_drawdown(weighted_returns)
    worst_day_return = float(weighted_returns.min())
    five_day_returns = (1.0 + weighted_returns).rolling(5).apply(np.prod, raw=True) - 1.0
    worst_five_day_return = float(five_day_returns.min()) if five_day_returns.notna().any() else 0.0

    holdings = []
    for index, symbol in enumerate(covered):
        individual_drawdown = _max_drawdown(stock_returns[symbol])
        row = rows[symbol]
        holdings.append({
            "symbol": symbol,
            "quantity": row["qty"],
            "marketValue": round(row["value"], 2),
            "weightPct": round(weights_all[symbol] * 100, 2),
            "unrealizedPnl": round(row["value"] - row["cost"], 2),
            "annualizedVolatilityPct": round(float(individual_volatility[index]) * 100, 2),
            "maxDrawdownPct": round(individual_drawdown * 100, 2),
            "beta": None if betas[symbol] is None else round(betas[symbol], 2),
            "riskContributionPct": round(float(contributions[index]) * 100, 2),
            "windowReturnPct": round(((1 + stock_returns[symbol]).prod() - 1) * 100, 2),
        })
    for symbol in rows:
        if symbol not in covered:
            row = rows[symbol]
            holdings.append({
                "symbol": symbol, "quantity": row["qty"], "marketValue": round(row["value"], 2),
                "weightPct": round(weights_all[symbol] * 100, 2),
                "unrealizedPnl": round(row["value"] - row["cost"], 2),
                "annualizedVolatilityPct": None, "maxDrawdownPct": None, "beta": None,
                "riskContributionPct": None, "windowReturnPct": None,
            })
    holdings.sort(key=lambda item: -item["marketValue"])

    hhi = sum(weight ** 2 for weight in weights_all.values())
    shock = float(payload.shockPct)
    uniform = _stress_result(total_value, shock)
    beta_available = len(covered) == len(rows) and all(betas[symbol] is not None for symbol in covered)
    beta_change = (sum(rows[symbol]["value"] * max(-100.0, betas[symbol] * shock) / 100.0
                       for symbol in covered) if beta_available else None)
    beta_adjusted = {
        "available": beta_available,
        "estimatedValueChange": round(beta_change, 2) if beta_change is not None else None,
        "estimatedRemainingValue": round(max(0.0, total_value + beta_change), 2) if beta_change is not None else None,
        "shockPct": round(shock, 2),
    }
    stress = {
        "uniform": uniform,
        "betaAdjusted": beta_adjusted,
        "historicalWorst": {
            "coveragePct": round(coverage * 100, 2),
            "worstDay": {"returnPct": round(worst_day_return * 100, 2),
                         "estimatedValueChange": round(covered_value * worst_day_return, 2)},
            "worstFiveDays": {"returnPct": round(worst_five_day_return * 100, 2),
                              "estimatedValueChange": round(covered_value * worst_five_day_return, 2)},
        },
    }

    return {
        "asOf": stock_returns.index[-1].strftime("%Y-%m-%d"),
        "window": {"start": stock_returns.index[0].strftime("%Y-%m-%d"),
                   "end": stock_returns.index[-1].strftime("%Y-%m-%d"),
                   "observations": int(len(stock_returns)), "coveragePct": round(coverage * 100, 2)},
        "summary": {
            "positionsCount": len(rows), "marketValue": round(total_value, 2), "costValue": round(total_cost, 2),
            "unrealizedPnl": round(total_value - total_cost, 2),
            "unrealizedPnlPct": round((total_value - total_cost) / total_cost * 100, 2),
            "annualizedVolatilityPct": round(portfolio_volatility * 100, 2),
            "maxDrawdownPct": round(max_drawdown * 100, 2),
            "var95OneDayPct": round(var95, 2),
            "expectedShortfall95Pct": round(expected_shortfall95, 2),
            "beta": None if portfolio_beta is None else round(portfolio_beta, 2),
            "betaBenchmark": benchmark_name,
            "diversificationRatio": round(diversification_ratio, 2),
            "averagePairwiseCorrelation": None if average_correlation is None else round(average_correlation, 2),
            "effectiveNumberOfStocks": round(1 / hhi, 2) if hhi > 0 else 0.0,
            "concentrationIndexPct": round(hhi * 100, 2),
            "largestHolding": holdings[0]["symbol"],
            "largestHoldingWeightPct": holdings[0]["weightPct"],
        },
        "holdings": holdings,
        "correlation": {"labels": covered,
                        "matrix": [[round(float(value), 2) for value in row] for row in correlation.to_numpy()],
                        "highestPairs": highest_pairs},
        "stress": stress,
        "warnings": warnings,
        "methodology": (
            "Daily returns for the stocks held today are combined using today's market-value weights. "
            "Annualized volatility uses the annualized covariance matrix (252 trading days); beta is covariance "
            "with NIFTY 50 divided by benchmark variance; diversification and risk contributions use the same "
            "covariance matrix. One-day 95% VaR and expected shortfall use historical simulation on the weighted "
            "daily return series. Maximum drawdown is calculated from that same hypothetical current-allocation "
            "return series. This estimates current allocation risk under historical movements; it is not the "
            "account's actual past performance and does not forecast future returns. The equal-fall and beta-adjusted "
            "outputs are scenarios, not predictions."
        ),
    }
