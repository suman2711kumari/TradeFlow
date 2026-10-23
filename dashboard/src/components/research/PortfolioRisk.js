import React, { useEffect, useState } from "react";
import { getJson, inr, ErrorBox, Spinner, StatCard, GLOSSARY } from "./shared";

// The Python service calculates several measures. We display the three that
// are simplest to understand and explain in a fresher interview.
export default function PortfolioRisk() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await getJson("/api/research/portfolio-risk"));
    } catch (err) {
      setError({ message: err.message, status: err.status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const risk = result && result.summary;

  if (error && error.status === 422) {
    return <section className="friendly-card">
      <h3>No holdings yet</h3>
      <p>First buy a stock using your virtual balance. Then the app can analyse how today's portfolio would have behaved on past market data.</p>
    </section>;
  }

  return (
    <>
      <section className="friendly-card">
        <div className="friendly-heading">
          <h3>Risk of your current holdings</h3>
          <p>Python uses past daily prices to calculate volatility, beta and drawdown. These are historical measures, not predictions.</p>
        </div>
        <div className="rule-explainer">
          <b>In simple words:</b> volatility is how much prices move, beta compares movement with NIFTY 50, and drawdown is the biggest fall from a previous peak.
        </div>
        <button className="research-run-btn" type="button" onClick={load} disabled={loading}>
          {loading ? "Calculating..." : "Refresh risk"}
        </button>
      </section>
      {loading && !result && <p className="research-loading"><Spinner /> Reading historical prices...</p>}
      {error && <ErrorBox title="Risk calculation unavailable" message={error.message} onRetry={load} />}
      {risk && <>
        <section className="friendly-card">
          <div className="friendly-heading"><h3>Portfolio risk summary</h3></div>
          <div className="friendly-stat-grid">
            <StatCard label="Current stock value" value={inr(risk.marketValue)} note="Simulated holdings" />
            <StatCard label="Volatility (yearly)" value={risk.annualizedVolatilityPct.toFixed(1) + "%"} tip={GLOSSARY.volatility} />
            <StatCard label="Beta vs NIFTY 50" value={risk.beta == null ? "Not available" : risk.beta.toFixed(2)} tip={GLOSSARY.beta} />
            <StatCard label="Max drawdown" value={Math.abs(risk.maxDrawdownPct).toFixed(1) + "%"} tip={GLOSSARY.drawdown} />
          </div>
          <p className="friendly-note">These values replay today's holdings over the available historical period. They do not reconstruct every trade made in the account.</p>
        </section>
        <section className="friendly-card">
          <div className="friendly-heading"><h3>What's in your portfolio?</h3><p>Weights are the share of your invested stock value in each company.</p></div>
          <div className="research-table-wrap">
            <table className="research-table">
              <thead><tr><th>Stock</th><th>Stock value</th><th>Portfolio weight</th></tr></thead>
              <tbody>{result.holdings.map(h => (
                <tr key={h.symbol}><td>{h.symbol}</td><td>{inr(h.marketValue)}</td><td>{h.weightPct}%</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        {result.warnings.length > 0 && <p className="friendly-note">{result.warnings[0]}</p>}
      </>}
    </>
  );
}
