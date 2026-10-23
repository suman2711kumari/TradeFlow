import React,{useEffect,useState} from "react";
import {getJson,inr,ErrorBox,Spinner,StatCard,GLOSSARY} from "./shared";
export default function PortfolioRisk(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(null),[fall,setFall]=useState(5),[days,setDays]=useState(20);
 const load=async amount=>{setLoading(true);setError(null);try{setData(await getJson("/api/research/portfolio-risk?shockPct="+(-amount)));}catch(e){setError({message:e.message,status:e.status});}finally{setLoading(false);}};
 useEffect(()=>{load(5);},[]);
 if(error?.status===422)return <section className="friendly-card friendly-empty"><h3>Buy your first paper stock</h3><p>Once you own a share, we can use its past prices to explain your holdings and possible market-drop scenarios.</p></section>;
 const s=data?.summary,st=data?.stress,p=data?.outlook?.periods.find(p=>p.tradingDays===days);
 const haveBeta=st&&st.betaAdjusted.betaAssumedForOneOf.length===0;
 const change=st&&(haveBeta?st.betaAdjusted.estimatedValueChange:st.uniform.estimatedValueChange);
 return <>
 <section className="friendly-card"><div className="friendly-heading"><h3>How is my portfolio doing?</h3><p>Your stocks' current estimated value, followed by a look at how they behaved in the past year.</p></div>
 <button className="research-run-btn" onClick={()=>load(fall)} disabled={loading} type="button">{loading?"Checking...":"Refresh my portfolio"}</button>
 </section>
 {loading&&!data&&<p className="research-loading"><Spinner/> Loading portfolio history...</p>}
 {error&&<ErrorBox message={error.message} title="Could not check your portfolio" onRetry={()=>load(fall)}/>}
 {data&&<>
 <section className="friendly-card"><div className="friendly-heading"><h3>Your investments today</h3></div>
 <div className="friendly-stat-grid"><StatCard label="Value of the stocks you hold" value={inr(s.marketValue)}/><StatCard label="Profit/loss on your current shares" value={inr(s.unrealizedPnl)} tone={s.unrealizedPnl>=0?"up":"down"}/><StatCard label="Biggest historical drop" value={Math.abs(s.maxDrawdownPct).toFixed(1)+"%"} tip={GLOSSARY.drawdown}/></div>
 <p className="friendly-note">Volatility: <b>{s.annualizedVolatilityPct.toFixed(1)}%</b> (how widely your portfolio's past returns moved). Beta against NIFTY 50: <b>{s.beta??"unavailable"}</b> (how its returns have moved relative to the market). These numbers describe the past, not your future profit.</p>
 </section>
 <section className="friendly-card"><div className="friendly-heading"><h3>What could my holdings be worth later?</h3><p>An illustration using the past year's average returns and fluctuations, keeping today's stock quantities unchanged.</p></div>
 <div className="scenario-row"><span>Look ahead:</span>{[5,20].map(n=><button key={n} className={"chip-btn"+(days===n?" chip-active":"")} onClick={()=>setDays(n)} type="button">{n} trading days</button>)}</div>
 {p&&<><div className="friendly-stat-grid"><StatCard label="Stock value today" value={inr(data.outlook.currentHoldingsValue)}/><StatCard label="Illustrated future stock value" value={inr(p.illustrativeValue)} note="Based on historical averages, NOT a reliable prediction" /></div>
 <div className="outlook-range"><div><span>Lower illustration</span><strong>{inr(p.lowerIllustration)}</strong></div><div><span>Upper illustration</span><strong>{inr(p.upperIllustration)}</strong></div></div></>}
 <p className="friendly-note">This is a possible-values illustration, not an ML portfolio forecast, guaranteed range or investment advice. It excludes uninvested cash and future buying/selling. Past averages may not continue.</p></section>
 <section className="friendly-card"><div className="friendly-heading"><h3>What if the overall market falls?</h3><p>Pick a hypothetical fall to explore its possible effect. This does not predict that a fall will happen.</p></div>
 <div className="scenario-row"><span>Market falls by:</span>{[5,10,20].map(n=><button className={"chip-btn"+(fall===n?" chip-active":"")} key={n} type="button" onClick={()=>{setFall(n);load(n)}}>{n}%</button>)}</div>
 {st&&<><div className="whatif-result"><span>Illustrated loss on your stock holdings</span><strong className="down">{inr(Math.abs(change))}</strong><small>Estimated remaining stock value: {inr(s.marketValue+change)}. {haveBeta?"Uses historical beta of your stocks.":"Uses an equal-percentage-drop assumption because some beta data is unavailable."}</small></div>
 <p className="friendly-note">This scenario checks what might happen IF the market dropped. It does not claim the market will fall.</p></>}
 </section>
 <section className="friendly-card"><div className="friendly-heading"><h3>Which stocks make up my portfolio?</h3></div><div className="research-table-wrap"><table className="research-table"><thead><tr><th>Stock</th><th>Current value</th><th>Share of holdings</th></tr></thead><tbody>{data.holdings.map(h=><tr key={h.symbol}><td>{h.symbol}</td><td>{inr(h.marketValue)}</td><td>{h.weightPct}%</td></tr>)}</tbody></table></div>
 {data.flags.length>0&&<p className="friendly-note">Something to notice: {data.flags[0]}</p>}
 {data.warnings.length>0&&<details className="friendly-details"><summary>Data limitations</summary>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</details>}
 </section>
 </>}
 </>;
}
