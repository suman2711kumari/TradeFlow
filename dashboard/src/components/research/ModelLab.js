import React,{useState} from "react";
import {getJson,Spinner,ErrorBox} from "./shared";
export default function ModelLab({defaultSymbol="TCS"}){
 const [result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const run=async()=>{setLoading(true);setError("");setResult(null);try{setResult(await getJson("/api/research/cnn?symbol="+encodeURIComponent(defaultSymbol)));}catch(e){setError(e.message)}finally{setLoading(false)}};
 return <section className="friendly-card"><div className="friendly-heading"><h3>Could a more advanced model do better?</h3><p>Optional experiment: a 1D CNN examines patterns across 30 trading sessions. We compare it with simpler approaches on the same unseen days.</p></div>
 <button className="research-run-btn" onClick={run} type="button" disabled={loading}>{loading?<><Spinner/> Checking...</>:"Compare the advanced model"}</button><p className="research-fineprint">Requires TensorFlow. The CNN uses a separate chronological training/validation/testing split; it is not part of the five walk-forward tests above.</p>
 {error&&<ErrorBox title="Comparison unavailable" message={error} onRetry={run}/>}
 {result&&<><div className="research-table-wrap"><table className="research-table"><thead><tr><th>Approach</th><th>Correct on unseen days</th><th>UP predictions</th><th>TP / FP / TN / FN</th></tr></thead><tbody>{result.models.map(m=><tr key={m.model}><td>{m.model}</td><td>{m.accuracyPct.toFixed(1)}%</td><td>{m.confusion ? `${((m.confusion.tp + m.confusion.fp) / Math.max(1, m.confusion.tp + m.confusion.fp + m.confusion.tn + m.confusion.fn) * 100).toFixed(1)}%` : "—"}</td><td>{m.confusion ? `${m.confusion.tp} / ${m.confusion.fp} / ${m.confusion.tn} / ${m.confusion.fn}` : "—"}</td></tr>)}</tbody></table></div><p className="friendly-note">{result.verdict}</p><p className="friendly-note">UP predictions shows the share of test sessions each method classified as UP. Confusion counts are true UP / false UP / true NOT UP / false NOT UP. The majority-class baseline is selected from training data only.</p></>}
 </section>;
}
