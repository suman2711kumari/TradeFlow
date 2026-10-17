import React, { useState } from "react";
import { STOCKS, formatMoney, getJson, signedPct, inr, GLOSSARY, StatCard, Term, ErrorBox, Spinner, LineChart } from "./shared";

const CHARGES = [["0.05", "Low (0.05% per trade)"], ["0.1", "Typical (0.1% per trade)"], ["0.2", "High (0.2% per trade)"]];

const Backtest = () => {
  const [form, setForm] = useState({ symbol: "TCS", years: 3, charges: "0.1", fast: 20, slow: 50 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const fast = Number(form.fast), slow = Number(form.slow);
  const valid = Number.isInteger(fast) && Number.isInteger(slow) && fast >= 2 && slow <= 250 && fast < slow;
  const needsMoreYears = slow > 150 && Number(form.years) < 2;

  const run = async () => {
    setLoading(true); setError("");
    try {
      const costBps = Math.round(Number(form.charges) * 100);
      setResult(await getJson(`/api/research/backtest?symbol=${encodeURIComponent(form.symbol)}&fast=${fast}&slow=${slow}&years=${form.years}&costBps=${costBps}`));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const st = result?.strategy;
  const bm = result?.benchmark;
  const diff = result ? st.finalValue - bm.finalValue : 0;
  const code = result?.symbol.replace(".NS", "");
  const name = STOCKS.find(([v]) => v === code)?.[1] || code;
  const start = result?.params.initialCapital;

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading"><h3>What if I had followed a simple rule?</h3><p>A time machine for trading ideas: replay a rule on real past prices and see what would have happened.</p></div>
        <div className="rule-explainer">
          <b>The rule we test:</b> buy when the stock's recent trend turns upward, and sell (move to cash) when it turns downward. We then compare it with the easiest alternative: buying once and just holding.
        </div>
        <div className="backtest-form">
          <label>Stock<select value={form.symbol} onChange={set("symbol")}>{STOCKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>How far back<select value={form.years} onChange={set("years")}>{[1, 2, 3, 5].map((y) => <option key={y} value={y}>{y} year{y > 1 ? "s" : ""}</option>)}</select></label>
          <label><Term label="Trading charges" tip={GLOSSARY.charges} /><select value={form.charges} onChange={set("charges")}>{CHARGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <button className="research-run-btn" type="button" onClick={run} disabled={loading || !valid}>{loading ? <><Spinner /> Replaying…</> : "Test this idea"}</button>
        </div>
        <details className="friendly-details">
          <summary>Customise the rule (optional)</summary>
          <div className="backtest-form">
            <label><Term label="Short average (days)" tip={GLOSSARY.sma} /><input type="number" min="2" max="100" value={form.fast} onChange={set("fast")} /></label>
            <label><Term label="Long average (days)" tip={GLOSSARY.sma} /><input type="number" min="5" max="250" value={form.slow} onChange={set("slow")} /></label>
          </div>
          <p className="research-fineprint">The short number must be smaller than the long one. Defaults of 20 and 50 are common.</p>
        </details>
        {!valid && <p className="research-inline-error">Use whole numbers where the short average is smaller than the long one (long average at most 250).</p>}
        {needsMoreYears && <p className="research-inline-error">A long average above 150 days needs at least 2 years of history.</p>}
      </section>

      {error && <ErrorBox title="Could not run the test" message={error} onRetry={run} />}

      {result && <>
        <section className="friendly-card">
          <div className="friendly-heading"><h3>What would have happened</h3><p>{name}, {result.period.start} to {result.period.end}, starting with {inr(start)}.</p></div>
          <div className="compare-grid">
            <div className={`compare-box ${diff >= 0 ? "compare-win" : ""}`}><span>Following the rule</span><strong>{inr(st.finalValue)}</strong><small>{signedPct(st.totalReturnPct, 1)} after charges</small></div>
            <div className={`compare-box ${diff < 0 ? "compare-win" : ""}`}><span>Just buying and holding</span><strong>{inr(bm.finalValue)}</strong><small>{signedPct(bm.totalReturnPct, 1)}</small></div>
          </div>
          <p className="friendly-note verdict">
            {diff >= 0
              ? <>The rule ended <b>{inr(diff)} ahead</b> of simply holding.</>
              : <>Simply holding would have ended <b>{inr(Math.abs(diff))} ahead</b> of the rule.</>}{" "}
            One test on one stock proves very little. Many simple rules look good on one stock and fail on another.
          </p>
          {result.warnings.length > 0 && <ul className="friendly-warnlist">{result.warnings.map((w, i) => <li key={i}>ℹ {w}</li>)}</ul>}
        </section>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>How your money would have grown</h3></div>
          <LineChart labels={result.equityCurve.map((p) => p.date)} format={(v) => `₹${formatMoney(v)}`}
            series={[{ name: "Following the rule", tone: "a", points: result.equityCurve.map((p) => p.strategy) }, { name: "Just holding", tone: "b", points: result.equityCurve.map((p) => p.benchmark) }]} />
          <div className="friendly-stat-grid">
            <StatCard label="Biggest fall" value={`${Math.abs(st.maxDrawdownPct).toFixed(1)}%`} note={`Holding: ${Math.abs(bm.maxDrawdownPct).toFixed(1)}%`} tone="down" tip={GLOSSARY.drawdown} />
            <StatCard label="Times it traded" value={st.trades} note="Each buy and sell pair" />
            <StatCard label="Charges paid" value={inr(st.totalCostsInr)} note="Brokerage, taxes, slippage" tip={GLOSSARY.charges} />
            <StatCard label="Time invested" value={`${st.exposurePct.toFixed(0)}%`} note="The rest of the time it sat in cash" />
          </div>
        </section>

        <details className="friendly-details">
          <summary>Show more details</summary>
          <div className="research-stat-list">
            <div><span>Trades that made money</span><strong>{st.winRatePct == null ? "n/a" : `${st.winRatePct}%`}</strong></div>
            <div><span>Average result per trade</span><strong>{st.avgTradeReturnPct == null ? "n/a" : signedPct(st.avgTradeReturnPct)}</strong></div>
            <div><span>Return before charges</span><strong>{signedPct(st.grossReturnPct)}</strong></div>
            <div><span><Term label="Return for the risk taken (Sharpe)" tip={GLOSSARY.sharpe} /></span><strong>{st.sharpe} <small>vs {bm.sharpe} for holding</small></strong></div>
            <div><span>Yearly ups & downs</span><strong>{st.annualizedVolatilityPct}% <small>vs {bm.annualizedVolatilityPct}% for holding</small></strong></div>
          </div>
          {result.recentTrades.length > 0 && <>
            <h4 className="friendly-subhead">Most recent trades</h4>
            <div className="research-stat-list">{[...result.recentTrades].reverse().map((t, i) => <div key={i}><span>Held {t.entry} to {t.exit}</span><strong className={t.returnPct >= 0 ? "up" : "down"}>{signedPct(t.returnPct)}</strong></div>)}</div>
          </>}
          <h4 className="friendly-subhead">Assumptions</h4>
          <ul className="friendly-warnlist">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}<li>{bm.description}</li></ul>
        </details>
      </>}
    </>
  );
};

export default Backtest;
