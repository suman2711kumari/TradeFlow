// Stock-level research: ML analysis, backtest and CNN experiment. Shared by REST controllers and the AI agent.
const { getHistory } = require("./marketData");
const { postToMl } = require("./mlClient");
const { ServiceError } = require("./errors");
const { ALLOWED_SYMBOLS, normalizeSymbol } = require("./universe");

function requireSymbol(input) {
  const symbol = normalizeSymbol(input);
  if (!ALLOWED_SYMBOLS.has(symbol)) throw new ServiceError(400, "Unsupported symbol. Choose one of the listed Indian stocks.");
  return symbol;
}

async function analyzeStock(input) {
  const symbol = requireSymbol(input);
  const quotes = await getHistory(symbol, 3);
  return postToMl("/analyze", { symbol: `${symbol}.NS`, quotes }, 90000);
}

async function backtestStock(input, params = {}) {
  const symbol = requireSymbol(input);
  const years = Number.isInteger(params.years) ? params.years : 3;
  if (years < 1 || years > 5) throw new ServiceError(400, "years must be between 1 and 5.");
  const fastWindow = Number(params.fastWindow ?? 20);
  const slowWindow = Number(params.slowWindow ?? 50);
  const costBps = Number(params.costBps ?? 10);
  if (!Number.isInteger(fastWindow) || !Number.isInteger(slowWindow) || fastWindow < 2 || slowWindow > 250 || fastWindow >= slowWindow) {
    throw new ServiceError(400, "Use whole-number windows with 2 <= fast < slow <= 250.");
  }
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 200) throw new ServiceError(400, "costBps must be between 0 and 200.");
  const quotes = await getHistory(symbol, years);
  return postToMl("/backtest", { symbol: `${symbol}.NS`, quotes, fastWindow, slowWindow, costBps }, 60000);
}

async function cnnCompare(input) {
  const symbol = requireSymbol(input);
  const quotes = await getHistory(symbol, 3);
  return postToMl("/cnn-compare", { symbol: `${symbol}.NS`, quotes }, 240000);
}

module.exports = { analyzeStock, backtestStock, cnnCompare, requireSymbol };
