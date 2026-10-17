import React, { useCallback, useEffect, useState } from "react";
import { STOCKS, formatMoney, getJson, signedPct, riskLevel, GLOSSARY, StatCard, ErrorBox, Spinner, LineChart } from "./shared";

const TREND_TEXT = {
  Upward: "The price is above its recent averages, which usually means a short-term uptrend.",
  Downward: "The price is below its recent averages, which usually means a short-term downtrend.",
  Mixed: "There is no clear short-term direction right now.",
};

const StockAnalysis = ({ onOpenAdvanced }) => {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async (requested) => {
    setLoading(true);
    setError("");
    try {
      setResult(await getJson(`/api/research/analyze?symbol=${encodeURIComponent(requested)}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check("RELIANCE"); }, [check]);

  const latest = result?.latest;
  const code = result?.symbol.replace(".NS", "");
  const name = STOCKS.find(([v]) => v === code)?.[1] || code;
  const level = latest ? riskLevel(latest.annualizedVolatilityPct) : null;

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading"><h3>Check a stock</h3><p>See how a stock has behaved recently, in simple terms. Pick one and press the button.</p></div>
        <div className="research-controls">
          <select aria-label="Choose a stock" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {STOCKS.map(([value, label]) => <option value={value} key={value}>{label} ({value})</option>)}
          </select>
          <button className="research-run-btn" type="button" onClick={() => check(symbol)} disabled={loading}>{loading ? <><Spinner /> Checking…</> : "Check this stock"}</button>
        </div>
      </section>

      {error && <ErrorBox title="Could not check this stock" message={error} onRetry={() => check(symbol)} />}
      {loading && !result && <div className="research-loading"><Spinner /> Getting the latest prices…</div>}

      {result && <>
        <section className="friendly-card">
          <div className="stock-title">
            <div><span className="research-symbol-badge">{code}</span><strong>{name}</strong></div>
            <div className="stock-price">
              <b>₹{formatMoney(latest.price)}</b>
              <span className={latest.dailyChange >= 0 ? "up" : "down"}>{latest.dailyChange >= 0 ? "▲" : "▼"} ₹{formatMoney(Math.abs(latest.dailyChange))} ({signedPct(latest.dailyChangePct)}) today</span>
            </div>
          </div>
          <LineChart labels={result.chart.map((p) => p.date)} height={200} format={(v) => `₹${formatMoney(v)}`}
            series={[{ name: "Closing price, last ~6 months", tone: result.chart[result.chart.length - 1].close >= result.chart[0].close ? "up" : "down", points: result.chart.map((p) => p.close) }]} />
        </section>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>In plain words</h3></div>
          <div className="friendly-stat-grid">
            <StatCard label="Past year" value={signedPct(latest.oneYearReturnPct, 1)} note="Change in price over 12 months" tone={latest.oneYearReturnPct >= 0 ? "up" : "down"} />
            <StatCard label="Ups & downs" value={level.label} note={`About ${latest.annualizedVolatilityPct.toFixed(0)}% a year`} tone={level.tone} tip={GLOSSARY.volatility} />
            <StatCard label="Biggest recent fall" value={`${Math.abs(latest.maxDrawdownPct).toFixed(1)}%`} note="High to low, last ~4 months" tone="down" tip={GLOSSARY.drawdown} />
          </div>
          <p className="friendly-note">
            {name} has had <b>{level.label.toLowerCase()}</b> ups and downs ({level.note}). {TREND_TEXT[latest.trend]}{" "}
            Past performance does not tell you what will happen next, so use this as background, not as a reason to buy or sell.
          </p>
        </section>

        <section className="friendly-card friendly-link-card">
          <div><h3>Want the technical side?</h3><p>The Advanced lab tests whether computer models can predict tomorrow's move, and honestly shows how they compare with simple guesses.</p></div>
          <button type="button" className="research-run-btn" onClick={() => onOpenAdvanced?.(symbol)}>Open Advanced lab →</button>
        </section>
      </>}
    </>
  );
};

export default StockAnalysis;
