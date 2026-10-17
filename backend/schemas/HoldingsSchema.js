const { Schema } = require("mongoose");

const HoldingsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  name: String,
  qty: Number,
  avg: Number,
  price: Number, // last traded price; live prices are fetched at read time
  net: String,
  day: String,
});

// One holding per user per symbol. Prevents duplicate rows when two first-time buys race.
// (If your database already has duplicates, MongoDB cannot build this index: merge or delete them once.)
HoldingsSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = { HoldingsSchema };
