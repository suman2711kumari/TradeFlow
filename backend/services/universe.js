// The set of instruments the app trades and researches. One list, used by orders, research and the agent.
const ALLOWED_SYMBOLS = new Set([
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC",
  "WIPRO", "ONGC", "KPITTECH", "QUICKHEAL", "HINDUNILVR", "BHARTIARTL",
  "TATAPOWER", "M&M", "LT", "AXISBANK", "BAJFINANCE", "MARUTI", "TITAN",
]);

function normalizeSymbol(input) {
  const requested = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  return requested.endsWith(".NS") ? requested.slice(0, -3) : requested;
}

function isAllowedSymbol(input) {
  return ALLOWED_SYMBOLS.has(normalizeSymbol(input));
}

module.exports = { ALLOWED_SYMBOLS, normalizeSymbol, isAllowedSymbol };
