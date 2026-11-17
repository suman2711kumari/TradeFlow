import React,{useEffect,useState} from "react";
import {getJson,inr,ErrorBox,Spinner,StatCard,GLOSSARY} from "./shared";
export default function PortfolioRisk(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(null),[fall,setFall]=useState(5);
 const load=async amount=>{setLoading(true);setError(null);try{setData(await getJson("/api/research/portfolio-risk?shockPct="+(-amount)));}catch(e){setError({message:e.message,status:e.status});}finally{setLoading(false);}};
 useEffect(()=>{load(5);},[]);
 if(error?.status===422)return <section className="friendly-card friendly-empty"><h3>Buy your first paper stock</h3><p>Once you own a share, we can use its past prices to explain your holdings and possible market-drop scenarios.</p></section>;
 const s=data?.summary,st=data?.stress;
 const haveBeta=Boolean(st?.betaAdjusted?.available);
 const change=st&&(haveBeta?st.betaAdjusted.estimatedValueChange:st.uniform.estimatedValueChange);
 return <>
 <section className="friendly-card"><div className="friendly-heading"><h3>How is my portfolio doing?</h3><p>Your current holdings, with risk estimates based on each stock's historical price movements and today's portfolio mix.</p></div>
 <button className="research-run-btn" onClick={()=>load(fall)} disabled={loading} type="button">{loading?"Checking...":"Refresh my portfolio"}</button>
 </section>
 {loading&&!data&&<p className="research-loading"><Spinner/> Loading portfolio history...</p>}
 {error&&<ErrorBox message={error.message} title="Could not check your portfolio" onRetry={()=>load(fall)}/>}
 {data&&<>
 <section className="friendly-card"><div className="friendly-heading"><h3>Your investments today</h3></div>
 <div className="friendly-stat-grid"><StatCard label="Value of the stocks you hold" value={inr(s.marketValue)}/><StatCard label="Profit/loss on your current shares" value={inr(s.unrealizedPnl)} tone={s.unrealizedPnl>=0?"up":"down"}/><StatCard label="Estimated annualized volatility" value={s.annualizedVolatilityPct.toFixed(1)+"%"}/><StatCard label="Historical maximum drawdown" value={Math.abs(s.maxDrawdownPct).toFixed(1)+"%"}/><StatCard label="1-day historical VaR (95%)" value={s.var95OneDayPct.toFixed(2)+"%"} note="Historical simulation, not a loss limit"/><StatCard label="Expected shortfall (95%)" value={s.expectedShortfall95Pct.toFixed(2)+"%"} note="Average loss in the worst 5% of days"/></div>
 <p className="friendly-note">Volatility measures how widely the weighted daily returns varied historically. Beta against NIFTY 50: <b>{s.beta??"unavailable"}</b> (how the current mix historically moved relative to the benchmark). Risk estimates use today's portfolio weights applied to historical daily stock returns. Drawdown, VaR and expected shortfall describe that hypothetical current allocation, not your actual past account performance or future losses.</p>
 {s.beta == null && <div className="rule-explainer"><b>Why is beta unavailable?</b> NIFTY 50 historical market data is missing or did not overlap enough with your stocks' data. We do not replace an unknown beta with 1. The market-fall test will use the simpler equal-fall assumption. Check the data warnings below.</div>}
 </section>
 <section className="friendly-card"><div className="friendly-heading"><h3>What if the overall market falls?</h3><p>Pick a hypothetical fall to explore its possible effect. This does not predict that a fall will happen.</p></div>
 <div className="scenario-row"><span>Market falls by:</span>{[5,10,20].map(n=><button className={"chip-btn"+(fall===n?" chip-active":"")} key={n} type="button" onClick={()=>{setFall(n);load(n)}}>{n}%</button>)}</div>
 {st&&<><div className="whatif-result"><span>Estimated change in stock value</span><strong className={change<=0?"down":"up"}>{inr(change)}</strong><small>Estimated remaining stock value: {inr(s.marketValue+change)}. {haveBeta?"Uses measured historical beta of your stocks.":"Assumes every holding falls by the selected percentage, because measured beta is unavailable for at least one stock. This is NOT a calculated beta of 1."}</small></div>
 <p className="friendly-note">This scenario checks what might happen IF the market dropped. It does not claim the market will fall.</p></>}
 </section>
 <section className="friendly-card"><div className="friendly-heading"><h3>Which stocks make up my portfolio?</h3></div><div className="research-table-wrap"><table className="research-table"><thead><tr><th>Stock</th><th>Current value</th><th>Share of holdings</th><th>Beta vs NIFTY 50</th></tr></thead><tbody>{data.holdings.map(h=><tr key={h.symbol}><td>{h.symbol}</td><td>{inr(h.marketValue)}</td><td>{h.weightPct}%</td><td>{h.beta == null ? "Unavailable" : h.beta.toFixed(2)}</td></tr>)}</tbody></table></div>
 
 {data.warnings.length>0&&<details className="friendly-details" open={s.beta==null}><summary>Why some numbers may be unavailable</summary>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
 </section>
 </>}
 </>;
}
