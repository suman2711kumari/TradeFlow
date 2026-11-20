// Paper-trade execution.
//  * The execution price ALWAYS comes from the server (live Yahoo quote). Any price sent by the browser is ignored.
//  * Money and share counts only change through atomic conditional updates (e.g. debit only if cash >= value).
//  * With a replica set (Atlas) all writes run inside one MongoDB transaction.
//    On a standalone local mongod, transactions are unavailable, so each completed step registers an undo action
//    that is run in reverse if a later step fails. That is compensation, not true atomicity: use a replica set for production-grade safety.
const mongoose = require("mongoose");
const { FundsModel } = require("../model/FundModel");
const { HoldingsModel } = require("../model/HoldingsModel");
const { OrdersModel } = require("../model/OrdersModel");
const { getFreshQuote } = require("./marketData");
const { supportsTransactions } = require("./dbCapabilities");
const { ServiceError } = require("./errors");
const { ALLOWED_SYMBOLS, normalizeSymbol } = require("./universe");

const MAX_QTY = 100000;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

function validateOrderInput(body) {
  const name = normalizeSymbol(body?.name);
  const qty = Number(body?.qty);
  const mode = String(body?.mode || "").toUpperCase();
  if (!ALLOWED_SYMBOLS.has(name)) throw new ServiceError(400, "Choose a supported instrument.");
  if (!Number.isSafeInteger(qty) || qty <= 0 || qty > MAX_QTY) throw new ServiceError(400, `Quantity must be a whole number between 1 and ${MAX_QTY}.`);
  if (!["BUY", "SELL"].includes(mode)) throw new ServiceError(400, "Mode must be BUY or SELL.");
  return { name, qty, mode };
}

async function rollback(undo) {
  for (const action of [...undo].reverse()) {
    try { await action(); }
    catch (err) { console.error("ROLLBACK STEP FAILED - account may need manual reconciliation:", err.message); }
  }
}

async function ensureFunds(d, userId, opts) {
  await d.FundsModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { upsert: true, ...opts });
}

async function core(d, { userId, name, qty, mode, price, quote }, session, undo) {
  const opts = session ? { session } : {};
  const value = round2(qty * price);
  await ensureFunds(d, userId, opts);

  let realizedPnl = null;
  let funds;

  if (mode === "BUY") {
    funds = await d.FundsModel.findOneAndUpdate({ userId, availableCash: { $gte: value } }, { $inc: { availableCash: -value } }, { new: true, ...opts });
    if (!funds) throw new ServiceError(400, "Insufficient funds");
    undo?.push(() => d.FundsModel.updateOne({ userId }, { $inc: { availableCash: value } }));

    const existing = await d.HoldingsModel.findOne({ userId, name }, null, opts);
    if (existing) {
      const totalQty = existing.qty + qty;
      const newAvg = round4((existing.qty * existing.avg + qty * price) / totalQty);
      const updated = await d.HoldingsModel.findOneAndUpdate(
        { _id: existing._id, qty: existing.qty },
        { $set: { qty: totalQty, avg: newAvg, price } },
        { new: true, ...opts },
      );
      if (!updated) throw new ServiceError(409, "Your holding changed while the order was processing. Please retry.");
      undo?.push(() => d.HoldingsModel.updateOne({ _id: existing._id }, { $set: { qty: existing.qty, avg: existing.avg, price: existing.price } }));
    } else {
      const [created] = await d.HoldingsModel.create([{ userId, name, qty, avg: price, price, net: "0.00%", day: "0.00%" }], opts);
      undo?.push(() => d.HoldingsModel.deleteOne({ _id: created._id }));
    }
  } else {
    // SELL: atomically take shares only if the user has enough of them.
    const before = await d.HoldingsModel.findOneAndUpdate(
      { userId, name, qty: { $gte: qty } },
      { $inc: { qty: -qty }, $set: { price } },
      { new: false, ...opts },
    );
    if (!before) {
      const any = await d.HoldingsModel.findOne({ userId, name, qty: { $gt: 0 } }, null, opts);
      throw new ServiceError(400, any ? "Not enough quantity" : "You don't own this stock");
    }
    undo?.push(() => d.HoldingsModel.updateOne({ _id: before._id }, { $inc: { qty }, $set: { price: before.price } }));
    realizedPnl = round2((price - before.avg) * qty);

    funds = await d.FundsModel.findOneAndUpdate({ userId }, { $inc: { availableCash: value } }, { new: true, ...opts });
    undo?.push(() => d.FundsModel.updateOne({ userId }, { $inc: { availableCash: -value } }));
  }

  const [order] = await d.OrdersModel.create([{ userId, name, qty, price, mode, value, realizedPnl }], opts);
  undo?.push(() => d.OrdersModel.deleteOne({ _id: order._id }));

  return {
    message: `${mode} successful`,
    execution: {
      orderId: String(order._id), name, mode, qty, price, value, realizedPnl,
      cashAfter: round2(funds.availableCash), priceAsOf: quote.asOf, priceSource: "Yahoo Finance (server-side quote)",
    },
  };
}

async function executeOrder(input, deps = {}) {
  const d = {
    FundsModel, HoldingsModel, OrdersModel, getFreshQuote, supportsTransactions,
    startSession: () => mongoose.startSession(), ...deps,
  };
  const { name, qty, mode } = validateOrderInput(input);
  const userId = input.userId;
  const quote = await d.getFreshQuote(name);
  const args = { userId, name, qty, mode, price: quote.price, quote };

  let result;
  try {
    if (d.supportsTransactions()) {
      const session = await d.startSession();
      try {
        await session.withTransaction(async () => { result = await core(d, args, session, null); });
      } finally {
        await session.endSession();
      }
    } else {
      const undo = [];
      try { result = await core(d, args, undefined, undo); }
      catch (err) { await rollback(undo); throw err; }
    }
  } catch (err) {
    if (err instanceof ServiceError) throw err;
    if (err?.code === 11000) throw new ServiceError(409, "A concurrent order conflicted with this one. Please retry.");
    console.error("Order processing failed:", err.message);
    throw new ServiceError(500, "Order processing failed. Refresh your funds and order history before retrying.");
  }

  if (mode === "SELL") { // best-effort tidy-up of fully sold holdings; readers also ignore qty <= 0
    d.HoldingsModel.deleteMany({ userId, name, qty: { $lte: 0 } }).catch(() => {});
  }
  return result;
}

module.exports = { executeOrder, validateOrderInput, round2 };
