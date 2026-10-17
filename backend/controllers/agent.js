const { runAgent, isConfigured } = require("../services/agent");
const { ServiceError } = require("../services/errors");
const { allow } = require("../services/rateLimit");

module.exports.status = (req, res) => {
  res.json({ configured: isConfigured(), model: process.env.GEMINI_MODEL || "gemini-3.5-flash" });
};

module.exports.chat = async (req, res) => {
  try {
    if (!allow(`agent:${req.userId}`, Number(process.env.AGENT_REQUESTS_PER_HOUR || 20))) {
      return res.status(429).json({ message: "You have reached the hourly limit for assistant questions. Please try again later." });
    }
    const result = await runAgent({ messages: req.body?.messages, userId: req.userId, language: req.body?.language });
    return res.json(result);
  } catch (err) {
    if (err instanceof ServiceError) return res.status(err.status).json({ message: err.message });
    console.error("Agent request failed:", err);
    return res.status(500).json({ message: "The assistant failed unexpectedly." });
  }
};
