// Contract check between Node and the Python ML service using SYNTHETIC prices (no Yahoo, no MongoDB needed).
// Usage: start ml-service (uvicorn app.main:app --port 8000), then:  node scripts/e2e-check.js
const market = require("../services/marketData");
const { HoldingsModel } = require("../model/HoldingsModel");
const portfolio = require("../services/portfolioService");
const analysis = require("../services/analysisService");

function series(seed, n, drift = 0.0004, vol = 0.013) {
  let s = seed, p = 100;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const out = [];
  const start = new Date("2023-10-02T03:45:00Z");
  for (let i = 0; out.length < n; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const o = p; p *= 1 + drift + vol * gauss();
    out.push({ date: d, open: o, high: Math.max(o, p) * 1.004, low: Math.min(o, p) * 0.996, close: p, volume: 1e6 + rnd() * 1e6 });
  }
  return out;
}
const seeds = { TCS: 1, INFY: 2, ITC: 3, "^NSEI": 9 };
market._setClient({
  chart: async (sym, opts) => {
    const key = sym.replace(".NS", "");
    const years = Math.round((opts.period2 - opts.period1) / (365 * 86400000));
    return { quotes: series(seeds[key] || 5, 252 * years).slice(-252 * years) };
  },
  quote: async (syms) => syms.map((s) => ({ symbol: s, regularMarketPrice: 110, regularMarketPreviousClose: 108 })),
});
HoldingsModel.find = () => ({ lean: async () => [
  { _id: "1", name: "TCS", qty: 10, avg: 100, price: 105 },
  { _id: "2", name: "INFY", qty: 20, avg: 90, price: 95 },
  { _id: "3", name: "ITC", qty: 5, avg: 100, price: 101 },
] });

(async () => {
  const risk = await portfolio.getPortfolioRisk("u1", -5);
  console.log("RISK  vol%", risk.summary.annualizedVolatilityPct, "maxDD%", risk.summary.maxDrawdownPct, "beta", risk.summary.beta,
    "| contribs", risk.holdings.map((h) => `${h.symbol}:${h.riskContributionPct}`).join(" "),
    "| obs", risk.window.observations, "| uniform", risk.stress.uniform.estimatedValueChange, "beta-adj", risk.stress.betaAdjusted.estimatedValueChange);
  const a = await analysis.analyzeStock("TCS");
  console.log("ANALYZE", a.walkForward.nSplits, "folds;", a.prediction.edgeAssessment.slice(0, 60));
  const b = await analysis.backtestStock("TCS", { fastWindow: 20, slowWindow: 50, years: 3, costBps: 10 });
  console.log("BACKTEST net%", b.strategy.totalReturnPct, "bh%", b.benchmark.totalReturnPct, "trades", b.strategy.trades);
  try { const c = await analysis.cnnCompare("TCS"); console.log("CNN", c.models.map((m) => `${m.model}:${m.accuracyPct}`).join(" | ")); }
  catch (e) { console.log("CNN skipped:", e.message); }
  const pos = await portfolio.getHoldingsWithLivePrices("u1");
  console.log("LIVE HOLDINGS", pos.holdings.map((h) => `${h.name} ${h.price} net ${h.net} day ${h.day}`).join(" ; "));
})().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
