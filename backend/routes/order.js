const express = require("express");
const router = express.Router();
const auth = require("../controllers/authMiddleware");
const { OrdersModel } = require("../model/OrdersModel");
const wrapAsync = require("../utils/wrapAsync.js");

const orderController = require("../controllers/order.js");


router.route("/")
.get(auth, wrapAsync(orderController.getOrders))

router.route("/newOrder")
.get(auth,orderController.renderNewForm)
.post(auth, wrapAsync(orderController.addNewOrder));

module.exports = router;