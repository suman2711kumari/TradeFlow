
const express = require("express");
const router = express.Router();

const fundsController = require("../controllers/funds");
const auth = require("../controllers/authMiddleware");

router.get("/", auth, fundsController.index);

module.exports = router;