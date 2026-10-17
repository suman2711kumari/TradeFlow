import React, { useCallback, useEffect, useState } from "react";
import { getJson, signedMoney, signedPct, inr, riskLevel, GLOSSARY, StatCard, Term, ErrorBox, Spinner } from "./shared";

const corrColor = (v) => {
  const a = Math.min(1, Math.abs(v));
  return v >= 0 ? `rgba(220, 80, 60, ${a * 0.55})` : `rgba(60, 130, 220, ${a * 0.55})`;
};

const PortfolioRisk = () => {
  const [fall, setFall] = useState(5);          // the user thinks in "market falls by X%"; the API takes a negative number
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (fallPct) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJson(`/api/research/portfolio-risk?shockPct=${encodeURIComponent(-Math.abs(fallPct))}`));
    } catch (e) {
      setError({ message: e.message, status: e.status });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(5); }, [load]);

  const fallNum = Number(fall);
  const validFall = fall !== "" && Number.isFinite(fallNum) && fallNum > 0 && fallNum <= 100;

  if (error?.status === 422) {
    return (
      <div className="friendly-card friendly-empty">
        <h3>You don't own any stocks yet</h3>
        <p>Buy a stock from your watchlist, and your portfolio health report will appear here. You don't need any past trading history: the report uses how your stocks behaved in the market over the past year.</p>
      </div>
    );
  }

  const s = data?.summary;
  const stress = data?.stress;
  const level = s ? riskLevel(s.annualizedVolatilityPct) : null;
  // Prefer the beta-adjusted estimate; fall back to the simple "everything falls equally" one if betas are unavailable.
  const betaUsable = stress && stress.betaAdjusted.betaAssumedForOneOf.length < data.holdings.length;
  const estimate = stress && (betaUsable
    ? { change: stress.betaAdjusted.estimatedValueChange, pct: stress.betaAdjusted.estimatedChangePct }
    : { change: stress.uniform.estimatedValueChange, pct: (stress.uniform.estimatedValueChange / s.marketValue) * 100 });

  return (
    <>
      {error && <ErrorBox title="Could not build your report" message={error.message} onRetry={() => load(fallNum || 5)} />}
      {loading && !data && <div className="research-loading"><Spinner /> Checking how your stocks behaved over the past year…</div>}

      {data && <>
        <section className="friendly-card">
          <div className="friendly-heading"><h3>Your portfolio health</h3><p>Based on how the stocks you hold today behaved over the past year.</p></div>
          <div className="health-row">
            <div className={`risk-badge ${level.tone}`}><span>Risk level</span><strong>{level.label}</strong></div>
            <p className="health-text">
              Over the past year, a portfolio like yours moved up and down by roughly <b>{s.annualizedVolatilityPct.toFixed(0)}%</b>, which is {level.note}.
              Its biggest fall from a high point to a low point was <b>{Math.abs(s.maxDrawdownPct).toFixed(1)}%</b>.
            </p>
          </div>
          <div className="friendly-stat-grid">
            <StatCard label="Portfolio value" value={inr(s.marketValue)} note={`${s.unrealizedPnl >= 0 ? "Up" : "Down"} ${inr(Math.abs(s.unrealizedPnl))} since you bought`} tone={s.unrealizedPnl >= 0 ? "up" : "down"} />
            <StatCard label="Biggest fall" value={`${Math.abs(s.maxDrawdownPct).toFixed(1)}%`} note="Past year, high to low" tone="down" tip={GLOSSARY.drawdown} />
            <StatCard label="A bad day" value={inr(s.var95OneDayInr)} note="Loss on about 1 day in 20 was at least this" tip={GLOSSARY.var} />
          </div>
        </section>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>What if the market falls?</h3><p>A "what if", not a prediction. Pick a fall to see the possible effect on your money.</p></div>
          <div className="scenario-row">
            <span>If the market falls by</span>
            {[5, 10, 20].map((v) => (
              <button key={v} type="button" className={`chip-btn${fallNum === v ? " chip-active" : ""}`} onClick={() => { setFall(v); load(v); }}>{v}%</button>
            ))}
            <input type="number" min="1" max="100" value={fall} onChange={(e) => setFall(e.target.value)} aria-label="Custom market fall percentage" />
            <button className="research-run-btn" type="button" onClick={() => load(fallNum)} disabled={loading || !validFall}>{loading ? <><Spinner /> Working…</> : "Show effect"}</button>
          </div>
          <div className="whatif-result">
            <span>You could lose about</span>
            <strong className="down">{inr(Math.abs(estimate.change))}</strong>
            <small>That is about {Math.abs(estimate.pct).toFixed(1)}% of your portfolio. Your portfolio would be worth roughly {inr(s.marketValue + estimate.change)}.</small>
          </div>
          <p className="friendly-note">
            This estimate takes into account that some stocks fall more than the market and some less.{" "}
            If every stock simply fell by the same {Math.abs(stress.marketShockPct)}%, the loss would be {inr(Math.abs(stress.uniform.estimatedValueChange))}.{" "}
            The worst real day your current stocks had in the past year ({stress.historicalWorst.worstDay.date}) would have cost you about {inr(Math.abs(stress.historicalWorst.worstDay.estimatedValueChange))}.
          </p>
        </section>

        <section className="friendly-card">
          <div className="friendly-heading"><h3>Where does your risk come from?</h3><p>Compare how much money is in each stock with how much of the ups and downs it causes.</p></div>
          <div className="research-table-wrap"><table className="friendly-table">
            <thead><tr><th>Stock</th><th>Share of your money</th><th><Term label="Share of the risk" tip={GLOSSARY.riskShare} /></th><th><Term label="Ups & downs" tip={GLOSSARY.volatility} /></th></tr></thead>
            <tbody>{data.holdings.map((h) => {
              const lvl = h.annualizedVolatilityPct == null ? null : riskLevel(h.annualizedVolatilityPct);
              return (
                <tr key={h.symbol}>
                  <td><b>{h.symbol}</b><small>{inr(h.marketValue)} · {h.sector}</small></td>
                  <td>{h.weightPct}%</td>
                  <td>{h.riskContributionPct == null ? "—" : <span className="bar-cell"><span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, h.riskContributionPct))}%` }} /></span>{h.riskContributionPct}%</span>}</td>
                  <td>{lvl ? <span className={`mini-badge ${lvl.tone}`}>{lvl.label}</span> : "—"}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>

        {(data.flags.length > 0 || data.warnings.length > 0) && (
          <section className="friendly-card friendly-watch">
            <div className="friendly-heading"><h3>Things to watch</h3></div>
            <ul>
              {data.flags.map((f, i) => <li key={`f${i}`}>⚠ {f}</li>)}
              {data.warnings.map((w, i) => <li key={`w${i}`} className="muted-li">ℹ {w}</li>)}
            </ul>
          </section>
        )}
        {data.flags.length === 0 && <p className="friendly-note">No major warning signs found: your money is reasonably spread out.</p>}

        <details className="friendly-details">
          <summary>Show advanced numbers</summary>
          <div className="friendly-stat-grid">
            <StatCard label="Yearly ups & downs" value={`${s.annualizedVolatilityPct.toFixed(1)}%`} tip={GLOSSARY.volatility} />
            <StatCard label="Beta vs NIFTY 50" value={s.beta ?? "n/a"} tip={GLOSSARY.beta} />
            <StatCard label="Diversification ratio" value={s.diversificationRatio} tip={GLOSSARY.diversification} />
            <StatCard label="Effective no. of stocks" value={s.effectiveNumberOfStocks} tip={GLOSSARY.effectiveStocks} />
            <StatCard label="Average correlation" value={s.averagePairwiseCorrelation ?? "n/a"} tip={GLOSSARY.correlation} />
            <StatCard label="Average loss on worst days" value={`${s.expectedShortfall95Pct}%`} tip={GLOSSARY.shortfall} />
          </div>

          <h4 className="friendly-subhead">Stock by stock</h4>
          <div className="research-table-wrap"><table className="research-table">
            <thead><tr><th>Stock</th><th>Yearly ups & downs</th><th><Term label="Beta" tip={GLOSSARY.beta} /></th><th><Term label="Biggest fall" tip={GLOSSARY.drawdown} /></th><th>Return (1y)</th></tr></thead>
            <tbody>{data.holdings.map((h) => (
              <tr key={h.symbol}><td>{h.symbol}</td><td>{h.annualizedVolatilityPct ?? "—"}{h.annualizedVolatilityPct != null && "%"}</td><td>{h.beta ?? "—"}</td><td>{h.maxDrawdownPct ?? "—"}{h.maxDrawdownPct != null && "%"}</td><td>{h.windowReturnPct == null ? "—" : signedPct(h.windowReturnPct)}</td></tr>))}</tbody>
          </table></div>

          {data.correlation.labels.length > 1 && <>
            <h4 className="friendly-subhead"><Term label="How your stocks move together" tip={GLOSSARY.correlation} /></h4>
            <div className="research-table-wrap"><table className="corr-table">
              <thead><tr><th />{data.correlation.labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
              <tbody>{data.correlation.matrix.map((row, i) => (
                <tr key={data.correlation.labels[i]}><th>{data.correlation.labels[i]}</th>{row.map((v, j) => <td key={j} style={{ background: corrColor(v) }}>{v.toFixed(2)}</td>)}</tr>))}</tbody>
            </table></div>
          </>}

          <h4 className="friendly-subhead">Money by sector</h4>
          <div className="research-stat-list">{data.sectors.map((x) => <div key={x.sector}><span>{x.sector}</span><strong>{x.weightPct}%</strong></div>)}</div>

          <h4 className="friendly-subhead">All three "what if" methods</h4>
          <div className="research-stat-list">
            <div><span>Every stock falls equally</span><strong>{signedMoney(stress.uniform.estimatedValueChange)}</strong></div>
            <div><span>Each stock falls by its beta × market fall</span><strong>{signedMoney(stress.betaAdjusted.estimatedValueChange)}</strong></div>
            <div><span>Worst single day in the past year ({stress.historicalWorst.worstDay.date})</span><strong>{signedMoney(stress.historicalWorst.worstDay.estimatedValueChange)}</strong></div>
            {stress.historicalWorst.worstFiveDays.estimatedValueChange != null && <div><span>Worst five days in a row (ending {stress.historicalWorst.worstFiveDays.endDate})</span><strong>{signedMoney(stress.historicalWorst.worstFiveDays.estimatedValueChange)}</strong></div>}
          </div>
          <details className="research-details"><summary>Beta-adjusted estimate for each stock</summary>
            <div className="research-stat-list">{stress.betaAdjusted.perHolding.map((h) => <div key={h.symbol}><span>{h.symbol}: beta {h.betaUsed}, so about {signedPct(h.estimatedMovePct)}</span><strong>{signedMoney(h.estimatedValueChange)}</strong></div>)}</div>
          </details>
          <p className="research-fineprint">{data.methodology} Window: {data.window.start} to {data.window.end} ({data.window.observations} trading days, {data.window.coveragePct}% of your money covered).</p>
        </details>
      </>}
    </>
  );
};

export default PortfolioRisk;
