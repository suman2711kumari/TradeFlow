import React,{useState} from "react";
import {getJson,Spinner,ErrorBox} from "./shared";
export default function ModelLab({defaultSymbol="TCS"}){
 const [result,setResult]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const run=async()=>{setLoading(true);setError("");setResult(null);try{setResult(await getJson("/api/research/cnn?symbol="+encodeURIComponent(defaultSymbol)));}catch(e){setError(e.message)}finally{setLoading(false)}};
 return <section className="friendly-card"><div className="friendly-heading"><h3>Could a more advanced model do better?</h3><p>Optional experiment: a 1D CNN examines patterns across 30 trading sessions. We compare it with simpler approaches on the same unseen days.</p></div>
 <button className="research-run-btn" onClick={run} type="button" disabled={loading}>{loading?<><Spinner/> Checking...</>:"Compare the advanced model"}</button><p className="research-fineprint">Requires TensorFlow. The CNN uses a separate chronological training/validation/testing split; it is not part of the five walk-forward tests above.</p>
 {error&&<ErrorBox title="Comparison unavailable" message={error} onRetry={run}/>}
 {result&&<><div className="research-table-wrap"><table className="research-table"><thead><tr><th>Approach</th><th>Correct on unseen days</th></tr></thead><tbody>{result.models.map(m=><tr key={m.model}><td>{m.model}</td><td>{m.accuracyPct.toFixed(1)}%</td></tr>)}</tbody></table></div><p className="friendly-note">{result.verdict}</p></>}
 </section>;
}
