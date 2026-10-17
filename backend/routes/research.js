const express = require("express");
const router = express.Router();
const auth = require("../controllers/authMiddleware");
const research = require("../controllers/research");

// All research endpoints require a signed-in user (they trigger market-data fetches and heavy computation).
router.use(auth);
router.get("/analyze", research.getResearchAnalysis);
router.get("/backtest", research.getBacktest);
router.get("/cnn", research.getCnnComparison);
router.get("/portfolio-risk", research.getPortfolioRisk);

module.exports = router;
