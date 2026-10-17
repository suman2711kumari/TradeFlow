import React, { useState } from "react";
import "./ResearchLab.css";
import StockAnalysis from "./research/StockAnalysis";
import PortfolioRisk from "./research/PortfolioRisk";
import Backtest from "./research/Backtest";
import AdvancedLab from "./research/AdvancedLab";

const TABS = [
  ["health", "My portfolio health"],
  ["stock", "Check a stock"],
  ["whatif", "What-if tester"],
  ["advanced", "Advanced lab"],
];

const ResearchLab = () => {
  const [tab, setTab] = useState("health");
  const [visited, setVisited] = useState(new Set(["health"]));
  const [advancedSymbol, setAdvancedSymbol] = useState("RELIANCE");

  const open = (id) => { setTab(id); setVisited((v) => new Set(v).add(id)); };
  const openAdvanced = (symbol) => { if (symbol) setAdvancedSymbol(symbol); open("advanced"); };

  return (
    <div className="research-lab">
      <section className="research-hero">
        <div>
          <div className="research-eyebrow"><span /> INSIGHTS</div>
          <h2>Understand your risk before you act.</h2>
          <p>See how risky your portfolio is, check a stock, or test an idea on past prices, all in plain language. This uses past market data to help you understand risk. It does not predict the future or tell you what to buy.</p>
        </div>
        <div className="research-model-chip"><span className="model-chip-dot" /> PAPER TRADING · SIMULATED MONEY</div>
      </section>

      <div className="research-tabs" role="tablist" aria-label="Insights sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`research-tab${tab === id ? " active" : ""}`} onClick={() => open(id)}>{label}</button>
        ))}
      </div>

      {/* A tab is created the first time it is opened, then kept so results are not lost when switching. */}
      {visited.has("health") && <div hidden={tab !== "health"}><PortfolioRisk /></div>}
      {visited.has("stock") && <div hidden={tab !== "stock"}><StockAnalysis onOpenAdvanced={openAdvanced} /></div>}
      {visited.has("whatif") && <div hidden={tab !== "whatif"}><Backtest /></div>}
      {visited.has("advanced") && <div hidden={tab !== "advanced"}><AdvancedLab key={advancedSymbol} defaultSymbol={advancedSymbol} /></div>}
    </div>
  );
};

export default ResearchLab;
