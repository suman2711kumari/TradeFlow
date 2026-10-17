const { Schema } = require("mongoose");

const OrdersSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  name: String,
  qty: Number,
  price: Number,      // execution price, set by the server from a live quote
  mode: String,
  value: Number,      // qty * price
  realizedPnl: Number // SELL only: (price - average cost) * qty
}, { timestamps: true });

OrdersSchema.index({ userId: 1, createdAt: -1 });

module.exports = { OrdersSchema };
