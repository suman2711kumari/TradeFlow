const { analyzeStock, backtestStock, cnnCompare } = require("../services/analysisService");
const { getPortfolioRisk } = require("../services/portfolioService");
const { ServiceError } = require("../services/errors");

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    if (err instanceof ServiceError) return res.status(err.status).json({ message: err.message });
    console.error("Research request failed:", err.message);
    res.status(500).json({ message: "The research request failed unexpectedly." });
  }
};

const intOrUndefined = (v) => (v === undefined || v === "" ? undefined : Number(v));

module.exports = {
  getResearchAnalysis: handle((req) => analyzeStock(req.query.symbol || "RELIANCE")),
  getBacktest: handle((req) => backtestStock(req.query.symbol || "RELIANCE", {
    years: intOrUndefined(req.query.years), fastWindow: intOrUndefined(req.query.fast),
    slowWindow: intOrUndefined(req.query.slow), costBps: intOrUndefined(req.query.costBps),
  })),
  getCnnComparison: handle((req) => cnnCompare(req.query.symbol || "RELIANCE")),
  getPortfolioRisk: handle((req) => {
    const shockPct = Number(req.query.shockPct ?? -5);
    if (!Number.isFinite(shockPct) || shockPct < -100 || shockPct > 100) throw new ServiceError(400, "shockPct must be between -100 and 100.");
    return getPortfolioRisk(req.userId, shockPct);
  }),
};
