import React, { useState, useEffect, useContext, useMemo } from "react";
import axios from "axios";
import GeneralContext from "./GeneralContext";
import { Tooltip, Grow } from "@mui/material";
import { BarChartOutlined, MoreHoriz } from "@mui/icons-material";
import { DoughnutChart } from "./DoughnoutChart";

const WatchList = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const apiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;

  useEffect(() => {
    let alive = true;
    const fetchMarketData = async () => {
      try {
        const res = await axios.get(`${apiUrl}/api/market/quotes`);
        if (alive && Array.isArray(res.data)) { setWatchlist(res.data); setLastUpdated(new Date()); }
      } catch { /* show the latest known market list while offline */ }
    };
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => { alive = false; clearInterval(interval); };
  }, [apiUrl]);

  const filtered = useMemo(() => watchlist.filter((stock) => `${stock.name || ""} ${stock.symbol || ""}`.toLowerCase().includes(query.trim().toLowerCase())), [watchlist, query]);
  const data = {
    labels: watchlist.map((stock) => stock.name),
    datasets: [{ label: "Price", data: watchlist.map((stock) => stock.price), backgroundColor: ["#5B8DEF", "#8B7CF6", "#35B8A6", "#E5A84B", "#E4779A", "#66A6C9"], borderWidth: 0 }],
  };

  return (
    <aside className="watchlist-container">
      <div className="watchlist-heading"><div><span className="eyebrow">MARKET RADAR</span><h2>Watchlist <span className="watchlist-count">{watchlist.length}</span></h2></div><span className="watchlist-status"><span />LIVE</span></div>
      <label className="search-container"><span className="search-symbol">⌕</span><input type="search" aria-label="Search watchlist" name="search" placeholder="Search stocks or symbols" className="search" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>/</kbd></label>
      <div className="watchlist-columns"><span>INSTRUMENT</span><span>PRICE / CHANGE</span></div>
      <ul className="list">
        {filtered.map((stock, index) => <WatchListItem stock={stock} key={stock.symbol || stock.name || index} />)}
        {filtered.length === 0 && <li className="watchlist-empty">{watchlist.length ? "No stocks match your search." : "Waiting for market quotes…"}</li>}
      </ul>
      <div className="watchlist-footnote"><span className="live-pulse" />{lastUpdated ? `Last synced ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Market data connecting"}</div>
      <div className="allocation-card"><div className="allocation-heading"><span>Market mix</span><span className="allocation-caption">WATCHLIST</span></div><div className="allocation-chart"><DoughnutChart data={data} /></div><p>Quick visual of the instruments currently on your radar.</p></div>
    </aside>
  );
};

const WatchListItem = ({ stock }) => {
  const [showActions, setShowActions] = useState(false);
  const isDown = Boolean(stock.isDown);
  return (
    <li className="watchlist-item-wrap" onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}>
      <div className="item"><div className="instrument-copy"><span className={`instrument-dot ${isDown ? "negative" : "positive"}`} /><div><p className={isDown ? "down" : "up"}>{stock.name}</p><small>{stock.symbol || "NSE · EQUITY"}</small></div></div><div className="itemInfo"><strong className="price">₹{Number(stock.price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className={`percent ${isDown ? "down" : "up"}`}>{isDown ? "▼" : "▲"} {stock.percent ?? "0.00%"}</span></div></div>
      {showActions && <WatchListActions stock={stock} />}
    </li>
  );
};

const WatchListActions = ({ stock }) => {
  const context = useContext(GeneralContext);
  return <div className="actions"><Tooltip title="Buy simulated shares" placement="top" arrow TransitionComponent={Grow}><button className="buy" onClick={() => context.openBuyWindow(stock, "BUY")}>Buy</button></Tooltip><Tooltip title="Sell simulated shares" placement="top" arrow TransitionComponent={Grow}><button className="sell" onClick={() => context.openBuyWindow(stock, "SELL")}>Sell</button></Tooltip><Tooltip title="Analytics (coming soon)" placement="top" arrow TransitionComponent={Grow}><button className="action" aria-label="Analytics coming soon"><BarChartOutlined className="icon" /></button></Tooltip><Tooltip title="More options" placement="top" arrow TransitionComponent={Grow}><button className="action" aria-label="More options"><MoreHoriz className="icon" /></button></Tooltip></div>;
};

export default WatchList;
