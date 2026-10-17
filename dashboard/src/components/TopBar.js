import React, { useEffect, useState } from "react";
import Menu from "./Menu";

const IndexCard = ({ label, item }) => (
  <div className="market-index">
    <span className="market-index-label"><span className="market-live-dot" />{label}</span>
    <strong>{item ? Number(item.price).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</strong>
    <span className={`market-index-change ${item?.isDown ? "down" : "up"}`}>
      {item ? `${item.isDown ? "▼" : "▲"} ${item.percent}%` : "Awaiting quote"}
    </span>
  </div>
);

const TopBar = () => {
  const apiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
  const [indices, setIndices] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let alive = true;
    const fetchIndices = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/market/indices`);
        if (!res.ok) throw new Error("Market index request failed");
        const data = await res.json();
        if (alive && Array.isArray(data)) { setIndices(data); setUpdatedAt(new Date()); }
      } catch { /* keep the last available quote if the API is temporarily unavailable */ }
    };
    fetchIndices();
    const interval = setInterval(fetchIndices, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [apiUrl]);

  return (
    <header className="app-header">
      <Menu />
      <div className="market-strip">
        <div className="market-strip-intro"><span className="live-pulse" />MARKET PULSE <span className="market-divider">/</span><span className="market-updated">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Connecting to market data"}</span></div>
        <div className="market-index-group">
          <IndexCard label="NIFTY 50" item={indices.find((index) => index.symbol === "^NSEI")} />
          <span className="index-separator" />
          <IndexCard label="SENSEX" item={indices.find((index) => index.symbol === "^BSESN")} />
        </div>
        <span className="simulation-pill"><span /> PAPER TRADING</span>
      </div>
    </header>
  );
};

export default TopBar;
