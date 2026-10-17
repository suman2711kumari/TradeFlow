const express = require("express");
const auth = require("../controllers/authMiddleware");

const router = express.Router();

const {
  getAllPositions
} = require("../controllers/positions");

router.get(
  "/api/allPositions",
  auth,
  getAllPositions
);

module.exports = router;