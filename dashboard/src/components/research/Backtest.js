import React, { useState } from "react";
import { STOCKS, getJson, inr, signedPct, ErrorBox, Spinner, LineChart } from "./shared";

// One understandable strategy: buy while SMA(20) > SMA(50), otherwise hold cash.
export default function Backtest() {
  const [symbol, setSymbol] = useState("TCS");
  const [years, setYears] = useState("3");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const url = "/api/research/backtest?symbol=" + encodeURIComponent(symbol)
        + "&years=" + years + "&fast=20&slow=50&costBps=10";
      setResult(await getJson(url));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Test a moving-average strategy</h3>
          <p>This replays an idea using past stock prices. It never places a real or paper trade.</p>
        </div>
        <div className="rule-explainer">
          <b>Simple rule:</b> compare the 20-day average price with the 50-day average.
          Stay invested when the short average is higher; otherwise stay in cash.
          The test uses the previous day's signal to avoid using future information.
        </div>
        <div className="backtest-form">
          <label>Stock
            <select value={symbol} onChange={e => setSymbol(e.target.value)}>
              {STOCKS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label>History
            <select value={years} onChange={e => setYears(e.target.value)}>
              <option value="2">2 years</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
            </select>
          </label>
          <button className="research-run-btn" type="button" disabled={loading} onClick={run}>
            {loading ? <><Spinner /> Running...</> : "Run backtest"}
          </button>
        </div>
        <p className="research-fineprint">For comparison, the simulator assumes a flat 0.1% cost per trade side. It is not an actual broker fee or tax calculation.</p>
      </section>
      {error && <ErrorBox title="Backtest unavailable" message={error} onRetry={run} />}
      {result && <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Results for {result.symbol}</h3>
          <p>{result.period.start} to {result.period.end}, starting with {inr(result.params.initialCapital)}</p>
        </div>
        <div className="compare-grid">
          <div className="compare-box">
            <span>Moving-average rule</span>
            <strong>{inr(result.strategy.finalValue)}</strong>
            <small>{signedPct(result.strategy.totalReturnPct, 1)} after assumed costs</small>
          </div>
          <div className="compare-box">
            <span>Buy and hold</span>
            <strong>{inr(result.benchmark.finalValue)}</strong>
            <small>{signedPct(result.benchmark.totalReturnPct, 1)}</small>
          </div>
        </div>
        <LineChart
          labels={result.equityCurve.map(p => p.date)}
          series={[
            { name: "Moving average", tone: "a", points: result.equityCurve.map(p => p.strategy) },
            { name: "Buy and hold", tone: "b", points: result.equityCurve.map(p => p.benchmark) }
          ]}
          format={v => inr(v)}
        />
        <p className="friendly-note">Strategy trades: {result.strategy.trades}. Historical returns are not a forecast of future returns.</p>
        {result.warnings.length > 0 && <p className="research-fineprint">{result.warnings[0]}</p>}
      </section>}
    </>
  );
}
