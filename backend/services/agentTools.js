// The agent's tool belt. Every tool is READ-ONLY, takes validated input, and runs with the authenticated user's id
// supplied by the server (the model can never choose whose data it reads). No tool places, changes or cancels orders.
// Services are referenced through their module objects (not destructured) so tests can substitute them.
const portfolio = require("./portfolioService");
const analysis = require("./analysisService");
const market = require("./marketData");
const { ServiceError } = require("./errors");
const { ALLOWED_SYMBOLS, normalizeSymbol } = require("./universe");

const SYMBOLS = [...ALLOWED_SYMBOLS];
const symbolProp = { type: "string", enum: SYMBOLS, description: "NSE symbol without the .NS suffix." };

function trimRisk(r) {
  return {
    asOf: r.asOf, window: r.window, summary: r.summary,
    holdings: r.holdings.map((h) => ({
      symbol: h.symbol, sector: h.sector, weightPct: h.weightPct, marketValue: h.marketValue, unrealizedPnl: h.unrealizedPnl,
      annualizedVolatilityPct: h.annualizedVolatilityPct, maxDrawdownPct: h.maxDrawdownPct, beta: h.beta, riskContributionPct: h.riskContributionPct,
    })),
    sectors: r.sectors, mostCorrelatedPairs: r.correlation.highestPairs, flags: r.flags, stress: r.stress, warnings: r.warnings,
  };
}

const TOOLS = [
  {
    name: "get_portfolio_summary",
    description: "The signed-in user's simulated holdings at live market prices: cash, invested value, current value, unrealised P&L and per-holding figures.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    run: (_input, ctx) => portfolio.getPortfolioSummary(ctx.userId),
  },
  {
    name: "get_portfolio_risk",
    description: "Risk report for the user's current holdings computed from one year of real daily prices: portfolio volatility, max drawdown, 1-day VaR/expected shortfall, correlations, beta vs NIFTY 50, each holding's contribution to portfolio risk, sector and concentration flags, and a default -5% stress test.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    run: async (_input, ctx) => trimRisk(await portfolio.getPortfolioRisk(ctx.userId, -5)),
  },
  {
    name: "run_stress_test",
    description: "Hypothetical market-move scenario on the user's current holdings. Returns three views: every stock moves by the same %, beta-adjusted moves, and a replay of the portfolio's worst historical day and worst five days. A sensitivity test, not a forecast.",
    input_schema: {
      type: "object",
      properties: { marketShockPct: { type: "number", minimum: -50, maximum: 50, description: "Market move in percent, e.g. -5 for a 5% fall." } },
      required: ["marketShockPct"], additionalProperties: false,
    },
    run: async (input, ctx) => {
      const shock = Number(input.marketShockPct);
      if (!Number.isFinite(shock) || shock < -50 || shock > 50) throw new ServiceError(400, "marketShockPct must be a number between -50 and 50.");
      const r = await portfolio.getPortfolioRisk(ctx.userId, shock);
      return { marketShockPct: shock, portfolioValue: r.summary.marketValue, portfolioBeta: r.summary.beta, stress: r.stress, warnings: r.warnings };
    },
  },
  {
    name: "get_stock_analysis",
    description: "Historical analysis of one stock: trend, realised volatility, drawdown, the Logistic Regression next-day probability, walk-forward out-of-sample accuracy against naive baselines, an honest edge assessment, and a cost-aware backtest of the model signal.",
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
    run: async (input) => {
      const symbol = normalizeSymbol(input.symbol);
      if (!ALLOWED_SYMBOLS.has(symbol)) throw new ServiceError(400, `Unsupported symbol. Allowed: ${SYMBOLS.join(", ")}`);
      const a = await analysis.analyzeStock(symbol);
      return {
        symbol: a.symbol, dataPoints: a.dataPoints, latest: a.latest, prediction: a.prediction,
        walkForwardSummary: a.walkForward.summary.map((m) => ({ model: m.model, accuracyPct: m.accuracyPct, f1Pct: m.f1Pct, meanFoldAccuracyPct: m.meanFoldAccuracyPct, stdFoldAccuracyPct: m.stdFoldAccuracyPct })),
        pooledTestSessions: a.walkForward.pooledSessions, signalBacktest: a.backtest, notes: a.researchNotes,
      };
    },
  },
  {
    name: "run_backtest",
    description: "Backtest a long-only moving-average crossover on one stock versus buy-and-hold, with transaction costs. Returns return, CAGR, volatility, Sharpe, max drawdown, trade count, win rate and total costs.",
    input_schema: {
      type: "object",
      properties: {
        symbol: symbolProp,
        fastWindow: { type: "integer", minimum: 2, maximum: 100, description: "Fast SMA length in sessions (default 20)." },
        slowWindow: { type: "integer", minimum: 5, maximum: 250, description: "Slow SMA length in sessions (default 50)." },
        years: { type: "integer", minimum: 1, maximum: 5, description: "Years of history (default 3)." },
        costBps: { type: "number", minimum: 0, maximum: 200, description: "Cost per side in basis points (default 10)." },
      },
      required: ["symbol"], additionalProperties: false,
    },
    run: async (input) => {
      const b = await analysis.backtestStock(input.symbol, {
        years: input.years === undefined ? undefined : Number(input.years),
        fastWindow: input.fastWindow, slowWindow: input.slowWindow, costBps: input.costBps,
      });
      const { equityCurve, ...rest } = b;
      return rest;
    },
  },
  {
    name: "get_market_quotes",
    description: "Latest market price and daily change for up to 10 supported symbols.",
    input_schema: { type: "object", properties: { symbols: { type: "array", items: symbolProp, minItems: 1, maxItems: 10 } }, required: ["symbols"], additionalProperties: false },
    run: async (input) => {
      if (!Array.isArray(input.symbols) || !input.symbols.length || input.symbols.length > 10) throw new ServiceError(400, "Provide 1 to 10 symbols.");
      const symbols = input.symbols.map(normalizeSymbol);
      const bad = symbols.filter((s) => !ALLOWED_SYMBOLS.has(s));
      if (bad.length) throw new ServiceError(400, `Unsupported symbol(s): ${bad.join(", ")}`);
      const quotes = await market.getQuotes(symbols);
      return symbols.map((s) => quotes.get(s) || { name: s, error: "quote unavailable" });
    },
  },
];

const byName = new Map(TOOLS.map((t) => [t.name, t]));
const toolDefinitions = TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

async function executeTool(name, input, ctx) {
  const tool = byName.get(name);
  if (!tool) throw new ServiceError(400, `Unknown tool: ${name}`);
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new ServiceError(400, "Tool input must be a JSON object.");
  return tool.run(input, ctx);
}

module.exports = { toolDefinitions, executeTool, TOOL_NAMES: TOOLS.map((t) => t.name) };
