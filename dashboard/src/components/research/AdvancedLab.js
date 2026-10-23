import React, { useState } from "react";
import { STOCKS, getJson, ErrorBox, Spinner } from "./shared";
import ModelLab from "./ModelLab";

// Two basic scikit-learn models + a simple guessing baseline.
// The CNN experiment below is intentionally separate: it uses a different split.
export default function AdvancedLab() {
  const [symbol, setSymbol] = useState("TCS");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
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

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Can ML predict tomorrow's direction?</h3>
          <p>We classify the next trading day's closing movement as UP or DOWN. We do not predict an exact share price.</p>
        </div>
        <div className="rule-explainer">
          <b>What we compare:</b> Logistic Regression, Random Forest and simple guessing rules.
          We train using earlier price data and evaluate on later unseen sessions.
        </div>
        <div className="research-controls">
          <select value={symbol} onChange={e => setSymbol(e.target.value)} aria-label="Stock">
            {STOCKS.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
          </select>
          <button type="button" className="research-run-btn" onClick={run} disabled={loading}>
            {loading ? <><Spinner /> Evaluating...</> : "Compare models"}
          </button>
        </div>
      </section>
      {error && <ErrorBox title="Model comparison failed" message={error} onRetry={run} />}
      {result && <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Results on unseen data</h3>
          <p>{result.walkForward.nSplits} expanding training/test periods, totalling {result.walkForward.pooledSessions} test sessions.</p>
        </div>
        <div className="research-table-wrap">
          <table className="research-table">
            <thead><tr><th>Model</th><th>Accuracy</th><th>F1 score</th></tr></thead>
            <tbody>{result.walkForward.summary.map(m => (
              <tr key={m.model}>
                <td>{m.model}{m.role === "Baseline" ? " (baseline)" : ""}</td>
                <td>{m.accuracyPct.toFixed(1)}%</td>
                <td>{m.f1Pct.toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="friendly-note">{result.prediction.edgeAssessment}</p>
        <p className="research-fineprint">Accuracy is the percentage of correctly classified sessions. F1 combines precision and recall. A complex model is not automatically better than a simple baseline.</p>
      </section>}
      <ModelLab key={symbol} defaultSymbol={symbol} />
    </>
  );
}
