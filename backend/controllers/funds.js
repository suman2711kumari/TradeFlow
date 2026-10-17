const { getFunds } = require("../services/portfolioService");

module.exports.index = async (req, res) => {
  try {
    res.json(await getFunds(req.userId));
  } catch (err) {
    console.error("Fetching funds failed:", err.message);
    res.status(500).json({ error: "Could not load funds." });
  }
};
