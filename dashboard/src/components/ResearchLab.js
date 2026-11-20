import React,{useState} from "react";
import "./ResearchLab.css";
import PortfolioRisk from "./research/PortfolioRisk";
import StockOutlook from "./research/StockOutlook";
import Backtest from "./research/Backtest";
import AdvancedLab from "./research/AdvancedLab";

const tabs=[
 ["portfolio","My portfolio"],
 ["stocks","Explore a stock"],
 ["strategy","Test a trading idea"],
 ["methods","How we checked"]
];
export default function ResearchLab(){
 const [tab,setTab]=useState("portfolio");
 return <div className="research-lab">
  <section className="research-hero"><div><div className="research-eyebrow"><span/> TRADEFLOW INSIGHTS</div><h2>Understand your investments</h2><p>Explore possible outcomes using past market data, understand how risky your holdings are, and see whether simple trading ideas worked. None of these estimates guarantees what happens next.</p></div><div className="research-model-chip">VIRTUAL MONEY · FOR LEARNING</div></section>
  <div className="research-tabs" role="tablist" aria-label="Insights sections">{tabs.map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={"research-tab"+(tab===id?" active":"")} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==="portfolio"&&<PortfolioRisk/>}
  {tab==="stocks"&&<StockOutlook/>}
  {tab==="strategy"&&<Backtest/>}
  {tab==="methods"&&<AdvancedLab/>}
 </div>;
}
