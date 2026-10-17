import React, { useState } from "react";
import { createPortal } from "react-dom";

export const apiUrl = `${window.location.protocol}//${window.location.hostname}:3002`;

export const formatMoney = (value) =>
  Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const signedPct = (value, digits = 2) =>
  `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(digits)}%`;

export const signedMoney = (value) =>
  `${Number(value) >= 0 ? "+" : "−"}₹${formatMoney(Math.abs(Number(value)))}`;

export const STOCKS = [
  ["RELIANCE", "Reliance Industries"], ["TCS", "Tata Consultancy Services"],
  ["INFY", "Infosys"], ["HDFCBANK", "HDFC Bank"], ["ICICIBANK", "ICICI Bank"],
  ["SBIN", "State Bank of India"], ["ITC", "ITC"], ["WIPRO", "Wipro"],
  ["ONGC", "ONGC"], ["KPITTECH", "KPIT Technologies"], ["QUICKHEAL", "Quick Heal"],
  ["HINDUNILVR", "Hindustan Unilever"], ["BHARTIARTL", "Bharti Airtel"],
  ["TATAPOWER", "Tata Power"], ["M&M", "Mahindra & Mahindra"], ["LT", "Larsen & Toubro"],
  ["AXISBANK", "Axis Bank"], ["BAJFINANCE", "Bajaj Finance"], ["MARUTI", "Maruti Suzuki"], ["TITAN", "Titan Company"],
];

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, { credentials: "include", ...options });
  } catch {
    throw new Error("Could not reach the backend. Check that it is running on port 3002.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? "Your session has expired. Please log in again."
      : data.message || data.error || "Request failed.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const getJson = (path) => request(path);
export const postJson = (path, body) =>
  request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const Metric = ({ label, value, detail, tone }) => (
  <div className="research-metric"><span>{label}</span><strong className={tone || ""}>{value}</strong>{detail && <small>{detail}</small>}</div>
);

export const Panel = ({ title, subtitle, tag, children, className = "" }) => (
  <section className={`research-panel ${className}`}>
    <div className="research-panel-heading">
      <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      {tag && <span className="research-live-tag">{tag}</span>}
    </div>
    {children}
  </section>
);

export const ErrorBox = ({ title = "Something went wrong", message, onRetry }) => (
  <div className="research-error" role="alert"><strong>{title}</strong><span>{message}</span>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</div>
);

export const Spinner = () => <span className="research-spinner" />;

/** Multi-series SVG line chart. series: [{ name, tone: "a"|"b"|"up"|"down", points: [number] }], labels: [string] */
export const LineChart = ({ series, labels, height = 220, format = (v) => v.toFixed(2) }) => {
  const all = series.flatMap((s) => s.points).filter(Number.isFinite);
  if (all.length < 2) return <div className="research-chart-empty">Not enough data to chart.</div>;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const spread = max - min || 1;
  const n = Math.max(...series.map((s) => s.points.length));
  const path = (points) =>
    points.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (n - 1)) * 100},${95 - ((v - min) / spread) * 88}`).join(" ");
  return (
    <div className="research-chart-wrap">
      <div className="research-chart-meta"><span>{labels?.[0]}</span><span>{labels?.[labels.length - 1]}</span></div>
      <svg className="research-chart" style={{ height }} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Line chart">
        <path d="M0,20 L100,20 M0,48 L100,48 M0,76 L100,76" className="chart-gridline" />
        {series.map((s) => <path key={s.name} d={path(s.points)} className={`chart-series chart-series-${s.tone || "a"}`} />)}
      </svg>
      <div className="research-chart-legend">
        <span>{format(min)} – {format(max)}</span>
        <span className="chart-key">{series.map((s) => <span key={s.name}><i className={`chart-swatch chart-series-${s.tone || "a"}`} />{s.name}</span>)}</span>
      </div>
    </div>
  );
};

export const ConfusionCell = ({ c }) => (
  <span className="confusion-mini" title="TP / FP / TN / FN">{c.tp}/{c.fp}/{c.tn}/{c.fn}</span>
);

/* ------------------------------------------------------------------ */
/* Plain-language helpers (added for the beginner-friendly redesign)   */
/* ------------------------------------------------------------------ */

export const inr = (value) => `₹${Math.round(Number(value)).toLocaleString("en-IN")}`;

/** A small "?" that explains a term in plain words. Rendered through a portal so scrolling tables never clip it. */
export const HelpTip = ({ text }) => {
  const [pos, setPos] = useState(null);
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 135), window.innerWidth - 135);
    setPos({ x, y: r.bottom + 8 });
  };
  const hide = () => setPos(null);
  return (
    <span
      className="help-tip" tabIndex={0} role="button" aria-label={`What does this mean? ${text}`}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onClick={(e) => (pos ? hide() : show(e))}
    >
      ?
      {pos && createPortal(<span className="help-pop" role="tooltip" style={{ left: pos.x, top: pos.y }}>{text}</span>, document.body)}
    </span>
  );
};

export const Term = ({ label, tip }) => <span className="term">{label}<HelpTip text={tip} /></span>;

/** One place for every plain-English explanation, so wording stays consistent. */
export const GLOSSARY = {
  accuracy: "Out of 100 predictions, how many were right. A coin flip gets about 50.",
  precision: "When the model said \"the stock will go up\", how often it really went up.",
  recall: "Of all the days the stock really went up, how many the model spotted.",
  f1: "One score that balances precision and recall. Higher is better.",
  confusion: "A count of right and wrong guesses. TP: said up and it went up. FP: said up but it fell. TN: said down and it fell. FN: said down but it rose.",
  baseline: "A baseline is a very simple guess, like \"always say up\". A model is only useful if it clearly beats this.",
  fold: "The model learns from older data, then is tested on the next period it has never seen. Each test period is a fold. Similar scores across folds mean the result is stable.",
  walkForward: "Testing the way real life works: learn from the past, predict the future, move forward in time and repeat.",
  volatility: "How much the price jumps up and down. Higher means a bumpier ride.",
  drawdown: "The biggest fall from a high point down to the next low point.",
  beta: "How strongly a stock moves with the overall market. Beta 1.5 means when the market falls 1%, this stock has usually fallen about 1.5%.",
  var: "On about 1 day in 20 over the past year, the loss was at least this much.",
  shortfall: "The average loss on the worst 1 day in 20.",
  correlation: "How similarly two stocks move. Close to 1 means they move together, so they protect you less. Close to 0 means they move independently.",
  diversification: "How much owning several stocks reduces your ups and downs compared with holding them separately. 1 means no benefit; higher is better.",
  effectiveStocks: "How many equally sized stocks your portfolio behaves like. If you own 5 stocks but one is huge, this number will be lower than 5.",
  riskShare: "How much of your portfolio's ups and downs come from this stock. A stock with a big risk share and a small money share is the risky one.",
  sharpe: "Profit earned for each unit of risk taken. Higher is better.",
  sma: "The average price over the last N days. When a short average rises above a long average, it is often read as an upward trend.",
  charges: "Brokerage, taxes and the small price difference every time you buy or sell. They quietly reduce your profit, so we include them.",
  cnn: "A CNN is an AI model that scans the last 30 days of prices for repeating patterns, a bit like a magnifying glass sliding along a chart.",
  pooling: "Pooling shrinks the data by keeping only the strongest signal from each small group, so the model focuses on the important patterns.",
  epoch: "One full pass of the AI model over its training data.",
};

/** Turns a yearly volatility % into a label a beginner can read. */
export const riskLevel = (volPct) => {
  const v = Number(volPct);
  if (v < 15) return { label: "Low", tone: "risk-low", note: "calm compared with most stock portfolios" };
  if (v < 25) return { label: "Medium", tone: "risk-mid", note: "about what you'd expect from a stock portfolio" };
  return { label: "High", tone: "risk-high", note: "bumpier than most stock portfolios" };
};

export const StatCard = ({ label, value, note, tone, tip }) => (
  <div className="friendly-stat">
    <span>{tip ? <Term label={label} tip={tip} /> : label}</span>
    <strong className={tone || ""}>{value}</strong>
    {note && <small>{note}</small>}
  </div>
);
