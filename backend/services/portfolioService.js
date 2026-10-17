// Read-side portfolio logic shared by the REST controllers and the AI agent.
const { HoldingsModel } = require("../model/HoldingsModel");
const { FundsModel } = require("../model/FundModel");
const { OrdersModel } = require("../model/OrdersModel");
const { getQuotes, getHistory, getBenchmarkHistory } = require("./marketData");
const { postToMl } = require("./mlClient");
const { ServiceError } = require("./errors");
const { normalizeSymbol } = require("./universe");

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const signed = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** Holdings priced at the latest market quote. Falls back to the last traded price (flagged) if Yahoo is unreachable. */
async function getHoldingsWithLivePrices(userId) {
  const docs = await HoldingsModel.find({ userId, qty: { $gt: 0 } }).lean();
  const quotes = await getQuotes(docs.map((h) => h.name));
  let allLive = true;
  const holdings = docs.map((h) => {
    const q = quotes.get(normalizeSymbol(h.name));
    const live = Boolean(q && !q.stale);
    if (!live) allLive = false;
    const price = q ? q.price : Number(h.price);
    const netPct = h.avg > 0 ? ((price - h.avg) / h.avg) * 100 : 0;
    return {
      _id: h._id, name: h.name, qty: h.qty, avg: h.avg, price,
      lastTradedPrice: h.price,
      net: signed(netPct),
      day: q?.changePct != null ? signed(q.changePct) : "—",
      isLoss: q?.changePct != null ? q.changePct < 0 : false,
      priceSource: live ? "live" : q ? "cached" : "last-trade",
      priceAsOf: q?.asOf || null,
    };
  });
  return { holdings, allLive };
}

async function getFunds(userId) {
  let funds = await FundsModel.findOne({ userId });
  if (!funds) funds = await FundsModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, new: true });
  return { openingBalance: round2(funds.openingBalance), availableCash: round2(funds.availableCash), usedMargin: round2(funds.usedMargin || 0) };
}

async function getPortfolioSummary(userId) {
  const [{ holdings, allLive }, funds] = await Promise.all([getHoldingsWithLivePrices(userId), getFunds(userId)]);
  const invested = holdings.reduce((t, h) => t + h.avg * h.qty, 0);
  const current = holdings.reduce((t, h) => t + h.price * h.qty, 0);
  return {
    pricesAreLive: allLive,
    cash: funds.availableCash,
    investedValue: round2(invested),
    currentValue: round2(current),
    unrealizedPnl: round2(current - invested),
    unrealizedPnlPct: invested > 0 ? round2(((current - invested) / invested) * 100) : 0,
    totalEquity: round2(current + funds.availableCash),
    holdings: holdings.map((h) => ({
      symbol: h.name, quantity: h.qty, avgCost: round2(h.avg), price: round2(h.price),
      marketValue: round2(h.price * h.qty), pnl: round2((h.price - h.avg) * h.qty),
      pnlPct: h.avg > 0 ? round2(((h.price - h.avg) / h.avg) * 100) : 0, dayChange: h.day, priceSource: h.priceSource,
    })),
  };
}

// India Standard Time start of "today" (UTC+5:30, no DST), so "today's positions" matches the trading day.
function startOfTodayIST(now = Date.now()) {
  const IST = 5.5 * 3600 * 1000;
  return new Date(Math.floor((now + IST) / 86400000) * 86400000 - IST);
}

/** Positions = today's trading activity per symbol (net quantity, realised and unrealised P&L). Delivery holdings live in Holdings. */
async function getTodayPositions(userId) {
  const orders = await OrdersModel.find({ userId, createdAt: { $gte: startOfTodayIST() } }).sort({ createdAt: 1 }).lean();
  const bySymbol = new Map();
  for (const o of orders) {
    const row = bySymbol.get(o.name) || { name: o.name, buyQty: 0, buyValue: 0, sellQty: 0, sellValue: 0 };
    if (o.mode === "BUY") { row.buyQty += o.qty; row.buyValue += o.qty * o.price; }
    else { row.sellQty += o.qty; row.sellValue += o.qty * o.price; }
    bySymbol.set(o.name, row);
  }
  const quotes = await getQuotes([...bySymbol.keys()]);
  return [...bySymbol.values()].map((r) => {
    const q = quotes.get(normalizeSymbol(r.name));
    const buyAvg = r.buyQty ? r.buyValue / r.buyQty : 0;
    const sellAvg = r.sellQty ? r.sellValue / r.sellQty : 0;
    const matched = Math.min(r.buyQty, r.sellQty);
    const realised = matched * (sellAvg - buyAvg);
    const net = r.buyQty - r.sellQty;
    const ltp = q?.price ?? (net >= 0 ? buyAvg : sellAvg);
    const openAvg = net > 0 ? buyAvg : sellAvg;
    const unrealised = net !== 0 ? net * (ltp - openAvg) : 0;
    return {
      name: r.name, product: "CNC", qty: net, avg: round2(net === 0 ? 0 : openAvg), price: round2(ltp),
      pnl: round2(realised + unrealised), boughtQty: r.buyQty, soldQty: r.sellQty,
      day: q?.changePct != null ? signed(q.changePct) : "—", isLoss: realised + unrealised < 0,
    };
  });
}

/** Full risk report built from REAL one-year market history of the stocks the user holds today. */
async function getPortfolioRisk(userId, shockPct = -5) {
  const { holdings } = await getHoldingsWithLivePrices(userId);
  if (!holdings.length) throw new ServiceError(422, "You have no holdings yet. Place a paper trade first, then risk analysis becomes available.");
  const warnings = [];
  const histories = {};
  await Promise.all(holdings.map(async (h) => {
    try {
      const rows = await getHistory(h.name, 1);
      histories[normalizeSymbol(h.name)] = rows.map((r) => ({ date: r.date, close: r.close }));
    } catch (err) {
      warnings.push(`${h.name}: ${err.message}`);
    }
  }));
  const bench = await getBenchmarkHistory(1);
  const result = await postToMl("/portfolio-risk", {
    positions: holdings.map((h) => ({ name: h.name, qty: h.qty, avg: h.avg, price: h.price })),
    histories,
    benchmark: bench ? bench.map((r) => ({ date: r.date, close: r.close })) : null,
    shockPct,
  }, 45000);
  result.warnings = [...warnings, ...(result.warnings || [])];
  return result;
}

module.exports = { getHoldingsWithLivePrices, getFunds, getPortfolioSummary, getTodayPositions, getPortfolioRisk, startOfTodayIST };
