import React, { useState } from "react";
import { STOCKS, getJson, signedPct, GLOSSARY, Term, ErrorBox, Spinner, ConfusionCell } from "./shared";
import ModelLab from "./ModelLab";

/** For analysts and curious users: honest machine-learning evaluation. Not needed for everyday use. */
const AdvancedLab = ({ defaultSymbol = "RELIANCE" }) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError("");
    try { setResult(await getJson(`/api/research/analyze?symbol=${encodeURIComponent(symbol)}`)); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const wf = result?.walkForward;
  const prediction = result?.prediction;
  const backtest = result?.backtest;
  const hasEdge = prediction && !prediction.edgeAssessment.startsWith("No demonstrated edge");

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading"><h3>Advanced lab</h3><p>For analysts and the curious. You do not need this section to use TradeFlow.</p></div>
        <div className="rule-explainer">
          <b>The question here:</b> can a computer model predict whether a stock will close higher tomorrow? We train popular models on past prices, test them on periods they have never seen, and compare them with dumb guesses. The honest answer is usually "not better than guessing", and this lab shows exactly that.
        </div>
        <div className="research-controls">
          <select aria-label="Choose a stock" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{STOCKS.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}</select>
          <button className="research-run-btn" type="button" onClick={run} disabled={loading}>{loading ? <><Spinner /> Testing models…</> : "Run model comparison"}</button>
        </div>
        {loading && <p className="research-fineprint">This trains several models on three years of prices and can take up to a minute.</p>}
      </section>

      {error && <ErrorBox title="Could not run the comparison" message={error} onRetry={run} />}

      {result && <>
        <div className={`edge-callout ${hasEdge ? "edge-some" : "edge-none"}`}>
          <strong>{hasEdge ? "A small edge was found" : "Result: no real edge found"}</strong>
          <p>{prediction.edgeAssessment}</p>
        </div>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>Model scorecard</h3><p>{wf.nSplits} test periods, {wf.pooledSessions} unseen trading days in total. Hover or tap the "?" next to any heading for a plain explanation.</p></div>
          <div className="research-table-wrap"><table className="research-table">
            <thead><tr>
              <th>Model</th>
              <th><Term label="Accuracy" tip={GLOSSARY.accuracy} /></th>
              <th><Term label="Precision" tip={GLOSSARY.precision} /></th>
              <th><Term label="Recall" tip={GLOSSARY.recall} /></th>
              <th><Term label="F1" tip={GLOSSARY.f1} /></th>
              <th><Term label="Stable?" tip={GLOSSARY.fold} /></th>
              <th><Term label="Right/wrong counts" tip={GLOSSARY.confusion} /></th>
            </tr></thead>
            <tbody>{wf.summary.map((m) => (
              <tr key={m.model} className={m.role === "Baseline" ? "row-baseline" : ""}>
                <td>{m.model}<small>{m.role === "Baseline" ? "Simple guess to beat" : m.role}</small></td>
                <td>{m.accuracyPct.toFixed(1)}%</td><td>{m.precisionPct.toFixed(1)}%</td><td>{m.recallPct.toFixed(1)}%</td><td>{m.f1Pct.toFixed(1)}%</td>
                <td>{m.meanFoldAccuracyPct.toFixed(1)} ± {m.stdFoldAccuracyPct.toFixed(1)}</td>
                <td><ConfusionCell c={m.confusion} /></td>
              </tr>))}</tbody>
          </table></div>
          <p className="friendly-note"><Term label="Baselines" tip={GLOSSARY.baseline} /> are the grey rows. If a model's accuracy is not clearly above them, it has not shown any skill. "Stable?" shows the average score across test periods and how much it wobbled (the number after ±).</p>
          <details className="research-details"><summary>Results for each test period</summary>
            <div className="research-table-wrap"><table className="research-table">
              <thead><tr><th><Term label="Period" tip={GLOSSARY.fold} /></th><th>Learned from</th><th>Tested on</th><th>Logistic</th><th>Forest</th><th>Majority guess</th><th>Always "up"</th></tr></thead>
              <tbody>{wf.folds.map((f) => (
                <tr key={f.fold}><td>{f.fold}</td><td>{f.trainStart} → {f.trainEnd}</td><td>{f.testStart} → {f.testEnd}</td>
                  <td>{f.accuracyPct.logisticRegression.toFixed(1)}%</td><td>{f.accuracyPct.randomForest.toFixed(1)}%</td><td>{f.accuracyPct.majorityBaseline.toFixed(1)}%</td><td>{f.accuracyPct.alwaysUp.toFixed(1)}%</td></tr>))}</tbody>
            </table></div>
            <p className="research-fineprint"><Term label="Walk-forward testing" tip={GLOSSARY.walkForward} />: always learn from older data and test on the next period.</p>
          </details>
        </section>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>Would trading on the model have paid?</h3><p>Out-of-sample replay including trading charges. Not a recommendation.</p></div>
          <div className="compare-grid">
            <div className="compare-box"><span>Trading on the model</span><strong className={backtest.strategyReturnPct >= 0 ? "up" : "down"}>{signedPct(backtest.strategyReturnPct)}</strong><small>Before charges: {signedPct(backtest.strategyGrossReturnPct)} · {backtest.trades} trades</small></div>
            <div className="compare-box"><span>Just holding</span><strong className={backtest.buyAndHoldReturnPct >= 0 ? "up" : "down"}>{signedPct(backtest.buyAndHoldReturnPct)}</strong><small>Same {backtest.testSessions} days</small></div>
          </div>
          <p className="research-fineprint">{backtest.rule}</p>
          <p className="friendly-note">For reference only: the model's guess for the next trading day is <b>{prediction.probabilityUpPct.toFixed(0)}% chance up</b>. {prediction.disclaimer}</p>
        </section>
      </>}

      <h3 className="friendly-section-title">Deep learning experiment</h3>
      <ModelLab defaultSymbol={symbol} />
    </>
  );
};

export default AdvancedLab;
