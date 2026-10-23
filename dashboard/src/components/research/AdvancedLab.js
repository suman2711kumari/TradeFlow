import React,{useState} from "react";
import {STOCKS,getJson,ErrorBox,Spinner} from "./shared";
import ModelLab from "./ModelLab";
export default function AdvancedLab(){
 const [symbol,setSymbol]=useState("TCS"),[result,setResult]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);setError("");setResult(null);try{setResult(await getJson("/api/research/analyze?symbol="+encodeURIComponent(symbol)));}catch(e){setError(e.message)}finally{setLoading(false)}};
 return <><section className="friendly-card"><div className="friendly-heading"><h3>How did we check the stock outlook?</h3><p>We compared simple computer models with basic guesses on historical days they had not seen before. You do not need to understand the algorithms to use TradeFlow.</p></div><div className="research-controls"><select aria-label="Company to evaluate" value={symbol} onChange={e=>setSymbol(e.target.value)}>{STOCKS.map(([s,name])=><option value={s} key={s}>{name}</option>)}</select><button type="button" className="research-run-btn" onClick={load} disabled={loading}>{loading?<><Spinner/> Checking history...</>:"Check past performance"}</button></div></section>
 {error&&<ErrorBox title="Could not check performance" message={error} onRetry={load}/>}
 {result&&<section className="friendly-card"><div className="friendly-heading"><h3>Were the computer guesses any better?</h3><p>Accuracy means how many times a guess was correct on unseen historical days. Higher is better, but is not a guarantee of future results.</p></div>
 <div className="research-table-wrap"><table className="research-table"><thead><tr><th>Method</th><th>Past accuracy</th></tr></thead><tbody>{result.walkForward.summary.map(m=><tr key={m.model}><td>{m.model}{m.role==="Baseline"?" (simple guess)":""}</td><td>{m.accuracyPct.toFixed(1)}%</td></tr>)}</tbody></table></div>
 <p className="friendly-note">{result.prediction.edgeAssessment}</p>
 <details className="friendly-details"><summary>How was this checked? (optional)</summary><p>We used five walk-forward tests: teach the models using older trading days, test on the next unseen period, then repeat. Logistic Regression and Random Forest were implemented with scikit-learn.</p></details></section>}
 <ModelLab key={symbol} defaultSymbol={symbol}/>
 </>;
}
