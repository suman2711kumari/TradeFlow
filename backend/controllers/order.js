const { OrdersModel } = require("../model/OrdersModel");
const { executeOrder } = require("../services/orderService");
const { ServiceError } = require("../services/errors");

module.exports.getOrders = async (req, res) => {
  try {
    const allOrders = await OrdersModel.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(allOrders);
  } catch (err) {
    console.error("Fetching orders failed:", err.message);
    res.status(500).json({ error: "Could not load orders." });
  }
};

module.exports.renderNewForm = (req, res) => {
  res.json({ message: "Buy form route" });
};

// POST /api/allOrders/newOrder  { name, qty, mode }
// A `price` in the body is deliberately ignored: the server executes at the live market quote.
module.exports.addNewOrder = async (req, res) => {
  try {
    const result = await executeOrder({
      userId: req.userId,
      name: req.body?.name,
      qty: req.body?.qty,
      mode: req.body?.mode,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof ServiceError) return res.status(err.status).json({ error: err.message });
    console.error("Unexpected order error:", err.message);
    return res.status(500).json({ error: "Order could not be completed. Please retry." });
  }
};
