const express = require("express");

const router = express.Router();

const {
    getMarketQuotes,
    getMarketIndices
} = require("../controllers/market");

router.get("/quotes", getMarketQuotes);
router.get("/indices", getMarketIndices);
module.exports = router;