const express = require("express");
const router = express.Router();
const auth = require("../controllers/authMiddleware");
const agent = require("../controllers/agent");

router.get("/status", auth, agent.status);
router.post("/chat", auth, agent.chat);

module.exports = router;
