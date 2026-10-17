const { model } = require("mongoose");
const { FundsSchema } = require("../schemas/FundSchema");

const FundsModel = model("Funds", FundsSchema);

module.exports = { FundsModel };