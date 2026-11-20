import React, { useState } from "react";
import { STOCKS, getJson, formatMoney, ErrorBox, Spinner, LineChart } from "./shared";

const CHOICES = [
  ["logisticRegression", "Logistic Regression"],
  ["randomForest", "Random Forest"],
  ["cnn", "1D CNN"],
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
  const chart = result?.chart || [];

  return <>
    <section className="friendly-card">
      <div className="friendly-heading">
        <h3>Explore a company's share prices</h3>
        <p>See historical prices and compare three experimental models that classify the direction of the next trading session.</p>
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
    {loading && !result && <div className="research-loading"><Spinner /> Loading historical data and model calculations...</div>}
    {result && <>
      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>{symbol}: what has the price done?</h3>
          <p>Last historical close: ₹{formatMoney(latest.price)} ({chart[chart.length - 1]?.date || "latest available session"}). This is historical market data, not a future price estimate.</p>
        </div>
        <LineChart labels={chart.map(x => x.date)}
          series={[{ name: "Past closing prices (not predictions)", tone: "a", points: chart.map(x => x.close) }]}
          format={value => "₹" + formatMoney(value)} />
        <p className="friendly-note"><b>Short-term trend:</b> {trend[latest.trend] || trend.Mixed} This compares the latest close with its 10- and 20-session moving averages. <b>Chart:</b> last 120 trading sessions (roughly six months). <b>One-year price change:</b> {latest.oneYearReturnPct}%.</p>
      </section>

      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Three models, three next-session estimates</h3>
          <p>Each model is trained on historical data and estimates whether the next session will close above the latest known close. These are model scores, not calibrated real-world probabilities.</p>
        </div>
        <div className="research-controls">
          <label>Prediction model
            <select value={selected} onChange={e => setSelected(e.target.value)}>
              {CHOICES.map(([key, name]) => <option key={key} value={key}>{name}{result.modelOutlooks?.[key]?.available === false ? " (unavailable)" : ""}</option>)}
            </select>
          </label>
        </div>
        {outlook?.available ? <>
          <div className="friendly-stat-grid">
            <div className="friendly-stat">
              <span>UP model score (not a calibrated probability)</span>
              <strong>{outlook.probabilityUpPct.toFixed(1)}%</strong>
              <small>{outlook.probabilityUpPct >= 45 && outlook.probabilityUpPct <= 55 ? "Too close to call (45–55% neutral band)" : outlook.probabilityUpPct > 55 ? "UP signal based on the model score" : "NOT UP signal based on the model score"}</small>
            </div>
            <div className="friendly-stat">
              <span>Accuracy on historical unseen data</span>
              <strong>{outlook.evaluationAccuracyPct.toFixed(1)}%</strong>
              <small>{outlook.evaluationLabel}</small>
            </div>
            <div className="friendly-stat">
              <span>Simple baseline accuracy</span>
              <strong>{outlook.baselineAccuracyPct.toFixed(1)}%</strong>
              <small>Reference score, not a trading benchmark</small>
            </div>
          </div>
          <div className="rule-explainer"><b>{outlook.model}</b>: {outlook.message}</div>
        </> : <div className="friendly-note">
          {outlook?.unavailableReason || "This model's prediction is unavailable in the current ML-service environment."}
          {selected === "cnn" ? " Install the optional dependencies with: python -m pip install -r requirements-cnn.txt, then restart the ML service." : " Try running the analysis again."}
        </div>}
        <p className="friendly-note">
          Logistic Regression and Random Forest are evaluated with expanding-window walk-forward validation. The CNN uses a separate chronological train/validation/test split, so its accuracy is not directly comparable to the other two. No model predicts an exact future price, and none is a buy/sell recommendation.
        </p>
      </section>
    </>}
  </>;
}
