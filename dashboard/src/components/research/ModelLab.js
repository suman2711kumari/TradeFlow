import React, { useState } from "react";
import { STOCKS, getJson, GLOSSARY, Term, Panel, ErrorBox, Spinner, LineChart, ConfusionCell } from "./shared";

const ModelLab = ({ defaultSymbol = "TCS" }) => {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true); setError(null);
    try { setResult(await getJson(`/api/research/cnn?symbol=${encodeURIComponent(symbol)}`)); }
    catch (e) { setError({ message: e.message, status: e.status }); }
    finally { setLoading(false); }
  };

  return (
    <>
      <Panel title="Deep learning lab: CNN vs simpler models" subtitle="Does a neural network beat simple models on days it has never seen?" tag="TENSORFLOW / KERAS" className="research-spaced">
        <div className="rule-explainer">
          <b>What is a CNN?</b> A CNN is a type of AI. Here it looks at the last 30 days of prices and tries to guess whether the next day will close higher. It uses Pooling to keep only the strongest patterns. We then compare it with simpler models and with plain guesses on the same unseen days. Expect it to land close to 50%: that is normal for daily stock prices.
        </div>
        <div className="research-controls">
          <select aria-label="Stock symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{STOCKS.map(([v, l]) => <option key={v} value={v}>{v} · {l}</option>)}</select>
          <button className="research-run-btn" type="button" onClick={run} disabled={loading}>{loading ? <><Spinner /> Training…</> : "Run experiment ↗"}</button>
        </div>
        {loading && <p className="research-fineprint">Training a small AI model on your computer. This usually takes 10 to 60 seconds.</p>}
      </Panel>

      {error && (error.status === 501
        ? <div className="edge-callout edge-none"><strong>TensorFlow is not installed</strong><p>{error.message}</p></div>
        : <ErrorBox title="Experiment failed" message={error.message} onRetry={run} />)}

      {result && <>
        <div className={`edge-callout ${result.verdict.includes("indistinguishable") || result.verdict.includes("worse") ? "edge-none" : "edge-some"}`}><strong>Verdict for {result.symbol.replace(".NS", "")}</strong><p>{result.verdict}</p></div>

        <Panel title="Results on the same unseen test window" subtitle={`${result.split.testSamples} sessions · ${result.split.testStart} to ${result.split.testEnd}`} className="research-spaced">
          <div className="research-table-wrap"><table className="research-table">
            <thead><tr><th>Model</th><th><Term label="Accuracy" tip={GLOSSARY.accuracy} /></th><th><Term label="Precision" tip={GLOSSARY.precision} /></th><th><Term label="Recall" tip={GLOSSARY.recall} /></th><th><Term label="F1" tip={GLOSSARY.f1} /></th><th><Term label="Right/wrong counts" tip={GLOSSARY.confusion} /></th></tr></thead>
            <tbody>{result.models.map((m) => (
              <tr key={m.model} className={m.role === "Naive baseline" ? "row-baseline" : ""}><td>{m.model}<small>{m.role}</small></td>
                <td>{m.accuracyPct.toFixed(1)}%</td><td>{m.precisionPct.toFixed(1)}%</td><td>{m.recallPct.toFixed(1)}%</td><td>{m.f1Pct.toFixed(1)}%</td><td><ConfusionCell c={m.confusion} /></td></tr>))}</tbody>
          </table></div>
        </Panel>

        <div className="research-main-grid research-lower-grid">
          <Panel title="Inside the CNN" subtitle={`${result.totalParams.toLocaleString("en-IN")} trainable parameters · input 30 × ${result.features.length}`}>
            <div className="research-table-wrap"><table className="research-table">
              <thead><tr><th>Layer</th><th>Output shape</th><th>Size</th></tr></thead>
              <tbody>{result.architecture.map((a) => <tr key={a.layer}><td>{a.layer}<small>{a.type}</small></td><td>{a.outputShape}</td><td>{a.params}</td></tr>)}</tbody>
            </table></div>
          </Panel>
          <Panel title="Learning progress" subtitle={`${result.training.epochsRun} training rounds · best result at round ${result.training.bestEpoch}`}>
            <LineChart height={180} labels={result.training.loss.map((_, i) => `epoch ${i + 1}`)} format={(v) => v.toFixed(3)}
              series={[{ name: "Train loss", tone: "a", points: result.training.loss }, { name: "Validation loss", tone: "b", points: result.training.valLoss }]} />
            <p className="research-fineprint">If the "validation" line stops improving while the "train" line keeps falling, the model is memorising noise instead of learning. We stop at the best round.</p>
          </Panel>
        </div>

        <Panel title="Predictions side by side" subtitle="Last 15 test sessions: probability of an up day" className="research-spaced">
          <div className="research-table-wrap"><table className="research-table">
            <thead><tr><th>Date</th><th>Actual</th><th>CNN</th><th>Logistic</th><th>Forest</th></tr></thead>
            <tbody>{result.predictions.map((p) => (
              <tr key={p.date}><td>{p.date}</td><td className={p.actualUp ? "up" : "down"}>{p.actualUp ? "Up" : "Down"}</td><td>{p.cnnProbUpPct}%</td><td>{p.logisticProbUpPct}%</td><td>{p.forestProbUpPct}%</td></tr>))}</tbody>
          </table></div>
        </Panel>

        <div className="research-methodology"><strong>Method notes</strong><ul>{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
      </>}
    </>
  );
};

export default ModelLab;
