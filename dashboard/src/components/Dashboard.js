import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Apps from "./Apps";
import Funds from "./Funds";
import Holdings from "./Holdings";
import Orders from "./Orders";
import Positions from "./Positions";
import Summary from "./Summary";
import WatchList from "./WatchList";
import ResearchLab from "./ResearchLab";
import AgentChat from "./AgentChat";
import { GeneralContextProvider } from "./GeneralContext";

const pageDetails = {
  "/summary": ["Portfolio overview", "Your market, at a glance."],
  "/orders": ["Order book", "Review your simulated trades."],
  "/holdings": ["Your holdings", "Track the stocks in your portfolio."],
  "/positions": ["Positions", "Monitor your current trading positions."],
  "/funds": ["Funds & equity", "Understand your available paper-trading balance."],
  "/apps": ["Trading tools", "Small tools for more informed practice."],
  "/research": ["Insights", "Understand your portfolio's risk, check a stock, or test an idea on past prices."],
  "/assistant": ["AI Assistant", "Ask questions about your portfolio and get plain-language answers."],
};

const DashboardContent = () => {
  const location = useLocation();
  const [title, subtitle] = pageDetails[location.pathname] || pageDetails["/summary"];
  return (
    <div className="workspace-layout">
      <WatchList />
      <main className="content workspace-content">
        <div className="workspace-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" />YOUR WORKSPACE</div><h1>{title}</h1><p>{subtitle}</p></div>
          <div className="workspace-date"><span className="date-icon">◷</span><span><strong>Simulation mode</strong><small>Practice without real orders</small></span></div>
        </div>
        <div className="route-panel">
          <Routes>
            <Route path="/summary" element={<Summary />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/research" element={<ResearchLab />} />
            <Route path="/assistant" element={<AgentChat />} />
            <Route path="*" element={<Summary />} />
          </Routes>
        </div>
        <footer className="workspace-footer"><span>TRADEFLOW <span className="footer-dot">●</span> PAPER TRADING ENVIRONMENT</span><span>Market data may be delayed. Orders are simulated.</span></footer>
      </main>
    </div>
  );
};

const Dashboard = () => <div className="dashboard-container"><GeneralContextProvider><DashboardContent /></GeneralContextProvider></div>;
export default Dashboard;
