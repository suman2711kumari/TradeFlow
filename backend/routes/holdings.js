// routes/holdings.js
const express = require("express");
const router = express.Router();
const auth = require("../controllers/authMiddleware");

const holdingController = require("../controllers/holdings.js");
router.route("/")
.get(auth, holdingController.index);


module.exports = router;