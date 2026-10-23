import React, { useState } from "react";
import { STOCKS, getJson, formatMoney, ErrorBox, Spinner, LineChart } from "./shared";

const CHOICES = [
  ["logisticRegression", "Logistic Regression"],
  ["randomForest", "Random Forest"],
];
const trend = {
  Upward: "Recent prices have generally moved upward.",
  Downward: "Recent prices have generally moved downward.",
  Mixed: "Recent prices have shown no clear direction.",
};

export default function StockOutlook() {
  const [symbol, setSymbol] = useState("TCS");
  const [selected, setSelected] = useState("logisticRegression");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await getJson("/api/research/analyze?symbol=" + encodeURIComponent(symbol)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const outlook = result?.modelOutlooks?.[selected];
  const latest = result?.latest;
  const p = result?.priceOutlook;

  return <>
    <section className="friendly-card">
      <div className="friendly-heading">
        <h3>Explore a company's share prices</h3>
        <p>See what actually happened in the past and check how reliable our experimental next-session direction guesses have been.</p>
      </div>
      <div className="research-controls">
        <label>Company
          <select value={symbol} onChange={e => { setSymbol(e.target.value); setResult(null); }}>
            {STOCKS.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
          </select>
        </label>
        <button className="research-run-btn" type="button" disabled={loading} onClick={load}>
          {loading ? <><Spinner /> Checking...</> : "Explore company"}
        </button>
      </div>
    </section>

    {error && <ErrorBox title="Could not analyse this company" message={error} onRetry={load} />}
    {result && <>
      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>{symbol}: what has the price done?</h3>
          <p>Last historical closing price: ₹{formatMoney(p.lastHistoricalClose)} ({p.lastHistoricalDate}). This can differ from today's latest quote.</p>
        </div>
        <LineChart labels={result.chart.map(x => x.date)}
          series={[{ name: "Past closing prices (not predictions)", tone: "a", points: result.chart.map(x => x.close) }]}
          format={value => "₹" + formatMoney(value)} />
        <p className="friendly-note">{trend[latest.trend] || trend.Mixed} Over the past year the closing price changed by {latest.oneYearReturnPct}%.</p>
      </section>

      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Can a computer guess the next direction?</h3>
          <p>Choose an approach to see its experimental guess about whether the next trading session closes above the last known close. Switching changes the displayed model's estimate.</p>
        </div>
        <div className="research-controls">
          <label>Prediction model
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              {CHOICES.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
          </label>
        </div>
        {outlook ? <>
          <div className="friendly-stat-grid">
            <div className="friendly-stat">
              <span>Experimental chance of a higher next close</span>
              <strong>{outlook.probabilityUpPct.toFixed(0)}%</strong>
              <small>From {outlook.model}, not a guaranteed or calibrated probability</small>
            </div>
            <div className="friendly-stat">
              <span>Correct guesses in historical testing</span>
              <strong>{outlook.walkForwardAccuracyPct.toFixed(1)}%</strong>
              <small>Five walk-forward test periods using previously unseen days</small>
            </div>
            <div className="friendly-stat">
              <span>Best simple guessing method</span>
              <strong>{outlook.baselineAccuracyPct.toFixed(1)}%</strong>
              <small>Reference score on those same historical days</small>
            </div>
          </div>
          <div className="rule-explainer">
            <b>{outlook.hasDemonstratedEdge ? "Historical testing showed a possible advantage." : "No convincing advantage over simple guessing."}</b>{" "}
            {outlook.message}
          </div>
          <p className="friendly-note">
            We do not show an exact future price: these models classify UP versus not-UP and have not been validated as price-forecasting models.
            The chart above is real past data, not a predicted price path.
          </p>
        </> : <p className="friendly-note">A current direction estimate is unavailable. Try refreshing your stock analysis.</p>}
      </section>
    </>}
  </>;
}
