import React, { useState } from "react";
import { getJson, ErrorBox, Spinner } from "./shared";

// Optional TensorFlow experiment. Same test window for CNN, LR and RF here.
// The standard Logistic/Forest table above uses five walk-forward folds instead.
export default function ModelLab({ defaultSymbol = "TCS" }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setError("");
    try {
      setResult(await getJson("/api/research/cnn?symbol=" + encodeURIComponent(defaultSymbol)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="friendly-card">
      <div className="friendly-heading">
        <h3>Optional: compare with a 1D CNN</h3>
        <p>The CNN learns short patterns from 30-day windows. This is an experiment, not a trading recommendation.</p>
      </div>
      <button className="research-run-btn" type="button" onClick={run} disabled={loading}>
        {loading ? <><Spinner /> Training...</> : "Run CNN comparison for " + defaultSymbol}
      </button>
      <p className="research-fineprint">CNN, Logistic Regression and Random Forest are evaluated on the same chronological test window in this experiment (60% training / 20% validation / 20% testing). TensorFlow is optional.</p>
      {error && <ErrorBox title="CNN experiment unavailable" message={error} onRetry={run} />}
      {result && <>
        <div className="research-table-wrap">
          <table className="research-table">
            <thead><tr><th>Model</th><th>Accuracy</th><th>F1 score</th></tr></thead>
            <tbody>{result.models.map(m => (
              <tr key={m.model}><td>{m.model}</td><td>{m.accuracyPct.toFixed(1)}%</td><td>{m.f1Pct.toFixed(1)}%</td></tr>
            ))}</tbody>
          </table>
        </div>
        <p className="friendly-note">{result.verdict}</p>
      </>}
    </section>
  );
}
