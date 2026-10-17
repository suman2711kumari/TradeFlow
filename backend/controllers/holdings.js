const { getHoldingsWithLivePrices } = require("../services/portfolioService");

// Returns the user's holdings priced at the latest market quote (not the stale last-trade price).
module.exports.index = async (req, res) => {
  try {
    const { holdings, allLive } = await getHoldingsWithLivePrices(req.userId);
    res.set("X-Prices-Live", String(allLive));
    res.json(holdings);
  } catch (err) {
    console.error("Fetching holdings failed:", err.message);
    res.status(500).json({ message: "Could not load holdings." });
  }
};
