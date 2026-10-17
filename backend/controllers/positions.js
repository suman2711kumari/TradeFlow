const { getTodayPositions } = require("../services/portfolioService");

// Positions = today's trading activity (net quantity and day P&L per symbol).
// Shares you hold beyond today are in Holdings, matching how brokers separate the two.
const getAllPositions = async (req, res) => {
  try {
    res.status(200).json(await getTodayPositions(req.userId));
  } catch (err) {
    console.error("Fetching positions failed:", err.message);
    res.status(500).json({ message: "Error fetching positions" });
  }
};

module.exports = { getAllPositions };
