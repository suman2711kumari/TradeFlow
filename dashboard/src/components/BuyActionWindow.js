import React, { useState, useContext, useMemo } from "react";
import axios from "axios";
import GeneralContext from "./GeneralContext";
import "./BuyActionWindow.css";

const currency = (value) => Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BuyActionWindow = ({ stock, uid, mode }) => {
  const apiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
  const stockName = typeof stock === "string" ? stock : (stock?.name || stock?.symbol || uid || "");
  // Indicative only: the server fetches its own live quote and executes at that price.
  const indicativePrice = Number(stock?.price);
  const [stockQuantity, setStockQuantity] = useState("1");
  const [executed, setExecuted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCostInfo, setShowCostInfo] = useState(false);
  const { closeBuyWindow, triggerOrdersRefresh } = useContext(GeneralContext);
  const qty = Number(stockQuantity);
  const price = indicativePrice;
  const orderValue = useMemo(() => Number.isSafeInteger(qty) && qty > 0 && Number.isFinite(price) && price > 0 ? qty * price : null, [qty, price]);
  const canSubmit = Number.isSafeInteger(qty) && qty > 0;
  const isBuy = String(mode || "").toUpperCase() === "BUY";

  const handleClick = async () => {
    setError("");
    if (!stockName.trim()) return setError("Please select a valid stock.");
    if (!Number.isSafeInteger(qty) || qty <= 0) return setError("Quantity must be a positive whole number.");
    setSubmitting(true);
    try {
      const res = await axios.post(`${apiUrl}/api/allOrders/newOrder`, { name: stockName, qty, mode: isBuy ? "BUY" : "SELL" }, { withCredentials: true });
      triggerOrdersRefresh();
      setExecuted(res.data.execution);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Order failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="order-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) closeBuyWindow(mode); }}>
      <section className="container_details" id="buy-window" role="dialog" aria-modal="true" aria-labelledby="order-window-title">
        <div className={`order-ticket-top ${isBuy ? "ticket-buy" : "ticket-sell"}`}><div><span className="ticket-kicker">TRADEFLOW / PAPER TRADE</span><h2 id="order-window-title">{isBuy ? "Buy instrument" : "Sell instrument"}</h2><p>Review your simulated order before placing it.</p></div><button type="button" className="ticket-close" aria-label="Close order ticket" onClick={() => closeBuyWindow(mode)} disabled={submitting}>×</button></div>
        <div className="regular-order">
          <div className="ticket-instrument-row"><div className="ticket-instrument-icon">{(stockName || "T").charAt(0).toUpperCase()}</div><div className="ticket-instrument-copy"><strong>{stockName || "No instrument selected"}</strong><span>{stock?.symbol || "NSE · PAPER EQUITY"}</span></div><span className={`order-mode-badge ${isBuy ? "buy-badge" : "sell-badge"}`}>{isBuy ? "BUY" : "SELL"}</span></div>
          <div className="inputs ticket-inputs"><fieldset><legend>Quantity</legend><input type="number" name="qty" id="qty" min="1" step="1" inputMode="numeric" onChange={(e) => setStockQuantity(e.target.value)} value={stockQuantity} disabled={submitting} /></fieldset><fieldset><legend>Market price (₹)</legend><input type="text" id="price" value={Number.isFinite(price) && price > 0 ? currency(price) : "Live price at order time"} readOnly aria-readonly="true" disabled /></fieldset></div>
          <div className="order-summary" aria-live="polite"><div className="summary-label"><span>Estimated order value (at market)</span><button type="button" className="info-button" onClick={() => setShowCostInfo((value) => !value)} aria-expanded={showCostInfo} aria-label="Explain order value">i</button></div><strong className="order-value">{orderValue === null ? "Enter valid values" : `₹${currency(orderValue)}`}</strong><div className="calculation-line"><span>{Number.isSafeInteger(qty) && qty > 0 ? qty : "Qty"} shares</span><span>×</span><span>{Number.isFinite(price) && price > 0 ? `₹${currency(price)}` : "Price"}</span></div>
            {showCostInfo && <div className="margin-explainer"><strong>Where does this amount come from?</strong><p>An estimate of <b>quantity × the latest market price</b>. The server fetches its own live quote when you place the order and executes at that price, so the final amount can differ slightly from this estimate.</p><p><b>This is order value, not broker margin.</b> This project currently simulates cash-based trades and does not calculate leverage, intraday margin, or an exchange-required margin. No real order is sent to a stock exchange.</p></div>}
            <p className="order-note">Executed at the live market price fetched by the server. Paper trading only, not an exchange order or margin requirement.</p>
          </div>
          {error && <p className="order-error" role="alert">{error}</p>}
          {executed && <div className="order-summary" role="status"><div className="summary-label"><span>Order executed</span></div><strong className="order-value">{executed.qty} × ₹{currency(executed.price)}</strong><p className="order-note">Total ₹{currency(executed.value)} · Cash left ₹{currency(executed.cashAfter)}{executed.realizedPnl != null && ` · Realised P&L ₹${currency(executed.realizedPnl)}`}</p><button type="button" className="cancel-order-btn" onClick={() => closeBuyWindow(mode)}>Done</button></div>}
          {!executed && <div className="buttons order-window-actions"><button type="button" className={`place-order-btn ${isBuy ? "place-buy" : "place-sell"}`} onClick={handleClick} disabled={submitting || !canSubmit}>{submitting ? <><span className="button-spinner" />Submitting order…</> : `Place simulated ${isBuy ? "buy" : "sell"}`}</button><button type="button" className="cancel-order-btn" onClick={() => closeBuyWindow(mode)} disabled={submitting}>Cancel</button></div>}
          <div className="ticket-disclaimer"><span>◇</span> Simulation only · No real money or exchange execution</div>
        </div>
      </section>
    </div>
  );
};

export default BuyActionWindow;
