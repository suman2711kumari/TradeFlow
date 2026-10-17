// Single place that talks to Yahoo Finance. Everything else (orders, holdings, research, agent) goes through here
// so prices are fetched server-side, cached briefly, and never trusted from the browser.
const YahooFinance = require("yahoo-finance2").default;
const { ServiceError } = require("./errors");
const { ALLOWED_SYMBOLS, normalizeSymbol } = require("./universe");

let client = null;
const getClient = () => (client ??= new YahooFinance());

const QUOTE_TTL_MS = 20 * 1000;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
const quoteCache = new Map(); // name -> { at, quote }
const historyCache = new Map(); // key -> { at, rows }

const toYahoo = (name) => `${normalizeSymbol(name)}.NS`;
const finite = (value) => Number.isFinite(Number(value)) && value !== null;

/** Latest quotes for several symbols. Returns Map(name -> {price, previousClose, changePct, asOf}). Missing symbols are omitted. */
async function getQuotes(names) {
  const unique = [...new Set(names.map(normalizeSymbol))].filter((n) => ALLOWED_SYMBOLS.has(n));
  const out = new Map();
  const now = Date.now();
  const stale = [];
  for (const name of unique) {
    const cached = quoteCache.get(name);
    if (cached && now - cached.at < QUOTE_TTL_MS) out.set(name, cached.quote);
    else stale.push(name);
  }
  if (stale.length) {
    try {
      const raw = await getClient().quote(stale.map(toYahoo));
      for (const item of Array.isArray(raw) ? raw : [raw]) {
        const price = Number(item?.regularMarketPrice);
        if (!item?.symbol || !Number.isFinite(price) || price <= 0) continue;
        const name = normalizeSymbol(item.symbol);
        const previousClose = Number(item.regularMarketPreviousClose);
        const quote = {
          name,
          price: Math.round(price * 100) / 100,
          previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null,
          changePct: Number.isFinite(previousClose) && previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : null,
          asOf: new Date().toISOString(),
        };
        quoteCache.set(name, { at: now, quote });
        out.set(name, quote);
      }
    } catch (err) {
      console.error("Quote fetch failed:", err.message);
      // fall back to any cached (even expired) quote so read-only pages still render
      for (const name of stale) {
        const cached = quoteCache.get(name);
        if (cached) out.set(name, { ...cached.quote, stale: true });
      }
    }
  }
  return out;
}

/** One live quote or a ServiceError. Used by the order engine, which must never fall back to a stale price. */
async function getFreshQuote(name) {
  const symbol = normalizeSymbol(name);
  if (!ALLOWED_SYMBOLS.has(symbol)) throw new ServiceError(400, `${symbol || "That symbol"} is not tradable in TradeFlow.`);
  const quote = (await getQuotes([symbol])).get(symbol);
  if (!quote || quote.stale) throw new ServiceError(503, "A live market price is unavailable right now, so the order was not placed. Please retry.");
  return quote;
}

/** Daily candles. `years` of history; cached for hours because history changes once a day. */
async function fetchHistory(yahooSymbol, years) {
  const key = `${yahooSymbol}:${years}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL_MS) return cached.rows;
  const period2 = new Date();
  const period1 = new Date(period2);
  period1.setFullYear(period1.getFullYear() - years);
  const history = await getClient().chart(yahooSymbol, { period1, period2, interval: "1d" });
  const rows = (history?.quotes || [])
    .filter((q) => q && q.date && finite(q.close) && Number(q.close) > 0)
    .map((q) => ({
      date: new Date(q.date).toISOString(),
      close: Number(q.close),
      open: finite(q.open) ? Number(q.open) : null,
      high: finite(q.high) ? Number(q.high) : null,
      low: finite(q.low) ? Number(q.low) : null,
      volume: finite(q.volume) ? Number(q.volume) : null,
    }));
  historyCache.set(key, { at: Date.now(), rows });
  return rows;
}

async function getHistory(name, years = 1) {
  const symbol = normalizeSymbol(name);
  if (!ALLOWED_SYMBOLS.has(symbol)) throw new ServiceError(400, `${symbol || "That symbol"} is not supported.`);
  try {
    return await fetchHistory(toYahoo(symbol), years);
  } catch (err) {
    console.error(`History fetch failed for ${symbol}:`, err.message);
    throw new ServiceError(502, `Could not fetch historical prices for ${symbol} from Yahoo Finance.`);
  }
}

async function getBenchmarkHistory(years = 1) {
  try {
    return await fetchHistory("^NSEI", years);
  } catch (err) {
    console.error("Benchmark history fetch failed:", err.message);
    return null;
  }
}

module.exports = {
  getQuotes, getFreshQuote, getHistory, getBenchmarkHistory,
  _setClient: (fake) => { client = fake; },          // tests
  _clearCaches: () => { quoteCache.clear(); historyCache.clear(); },
};
