import React, { useState } from "react";
import "./ResearchLab.css";
import PortfolioRisk from "./research/PortfolioRisk";
import Backtest from "./research/Backtest";
import AdvancedLab from "./research/AdvancedLab";

// Three topics, matching the three technical parts in the resume.
const tabs = [
  ["risk", "Portfolio risk"],
  ["backtest", "Moving-average test"],
  ["models", "ML comparison"],
];

export default function ResearchLab() {
  const [tab, setTab] = useState("risk");
  return (
    <div className="research-lab">
      <section className="research-hero">
        <div>
          <div className="research-eyebrow"><span /> TRADEFLOW INSIGHTS</div>
          <h2>Learn from your paper trades</h2>
          <p>Understand historical risk, test one trading rule, and compare basic ML models. This is for learning, not investment advice.</p>
        </div>
        <div className="research-model-chip">SIMULATED TRADING</div>
      </section>
      <div className="research-tabs" role="tablist" aria-label="Insights sections">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={"research-tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "risk" && <PortfolioRisk />}
      {tab === "backtest" && <Backtest />}
      {tab === "models" && <AdvancedLab />}
    </div>
  );
}
