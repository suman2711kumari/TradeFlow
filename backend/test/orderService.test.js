const test = require("node:test");
const assert = require("node:assert/strict");
const { executeOrder, validateOrderInput } = require("../services/orderService");
const { ServiceError } = require("../services/errors");
const { makeWorld } = require("./fakeMongo");

const quoteAt = (price) => async () => ({ price, asOf: "2026-10-13T05:00:00.000Z" });
const deps = (world, price = 100, extra = {}) => ({ ...world, getFreshQuote: quoteAt(price), supportsTransactions: () => false, ...extra });
const U = "user1";

test("BUY executes at the SERVER price and ignores a client-supplied price", async () => {
  const w = makeWorld();
  const res = await executeOrder({ userId: U, name: "TCS", qty: 5, mode: "BUY", price: 1 }, deps(w, 100));
  assert.equal(res.execution.price, 100);
  assert.equal(w.FundsModel.docs[0].availableCash, 9500);
  assert.equal(w.HoldingsModel.docs[0].avg, 100);
  assert.equal(w.OrdersModel.docs[0].price, 100);
});

test("a user cannot buy at Rs 1 and sell at Rs 10,000: both legs use market prices", async () => {
  const w = makeWorld();
  await executeOrder({ userId: U, name: "TCS", qty: 10, mode: "BUY", price: 1 }, deps(w, 100));
  const sell = await executeOrder({ userId: U, name: "TCS", qty: 10, mode: "SELL", price: 10000 }, deps(w, 101));
  assert.equal(sell.execution.realizedPnl, 10);          // (101-100)*10, not 99,990
  assert.equal(w.FundsModel.docs[0].availableCash, 10010);
});

test("insufficient funds is rejected and nothing is written", async () => {
  const w = makeWorld({ cash: 500 });
  await assert.rejects(executeOrder({ userId: U, name: "TCS", qty: 10, mode: "BUY" }, deps(w, 100)), (e) => e instanceof ServiceError && e.message === "Insufficient funds");
  assert.equal(w.FundsModel.docs[0].availableCash, 500);
  assert.equal(w.HoldingsModel.docs.length, 0);
  assert.equal(w.OrdersModel.docs.length, 0);
});

test("second BUY averages the cost price", async () => {
  const w = makeWorld();
  await executeOrder({ userId: U, name: "INFY", qty: 10, mode: "BUY" }, deps(w, 100));
  await executeOrder({ userId: U, name: "INFY", qty: 10, mode: "BUY" }, deps(w, 120));
  assert.equal(w.HoldingsModel.docs[0].qty, 20);
  assert.equal(w.HoldingsModel.docs[0].avg, 110);
});

test("SELL validates ownership and quantity", async () => {
  const w = makeWorld();
  await assert.rejects(executeOrder({ userId: U, name: "ITC", qty: 1, mode: "SELL" }, deps(w)), /don't own/);
  await executeOrder({ userId: U, name: "ITC", qty: 3, mode: "BUY" }, deps(w, 100));
  await assert.rejects(executeOrder({ userId: U, name: "ITC", qty: 4, mode: "SELL" }, deps(w)), /Not enough quantity/);
  const ok = await executeOrder({ userId: U, name: "ITC", qty: 3, mode: "SELL" }, deps(w, 110));
  assert.equal(ok.execution.realizedPnl, 30);
  assert.equal(w.HoldingsModel.docs.length, 0, "fully sold holding is removed");
});

test("other users' holdings are never touched", async () => {
  const w = makeWorld();
  await executeOrder({ userId: "alice", name: "TCS", qty: 2, mode: "BUY" }, deps(w, 100));
  await assert.rejects(executeOrder({ userId: "bob", name: "TCS", qty: 1, mode: "SELL" }, deps(w)), /don't own/);
});

test("failure mid-BUY rolls back cash and holding (standalone-Mongo compensation path)", async () => {
  const w = makeWorld();
  await executeOrder({ userId: U, name: "TCS", qty: 2, mode: "BUY" }, deps(w, 100));       // baseline: cash 9800
  w.OrdersModel.failCreate = true;
  await assert.rejects(executeOrder({ userId: U, name: "TCS", qty: 3, mode: "BUY" }, deps(w, 100)), (e) => e.status === 500);
  assert.equal(w.FundsModel.docs[0].availableCash, 9800);
  assert.equal(w.HoldingsModel.docs[0].qty, 2);
  assert.equal(w.HoldingsModel.docs[0].avg, 100);
});

test("failure mid-SELL rolls back shares and cash", async () => {
  const w = makeWorld();
  await executeOrder({ userId: U, name: "TCS", qty: 5, mode: "BUY" }, deps(w, 100));       // cash 9500
  w.OrdersModel.failCreate = true;
  await assert.rejects(executeOrder({ userId: U, name: "TCS", qty: 2, mode: "SELL" }, deps(w, 120)), (e) => e.status === 500);
  assert.equal(w.FundsModel.docs[0].availableCash, 9500);
  assert.equal(w.HoldingsModel.docs[0].qty, 5);
});

test("two simultaneous BUYs cannot spend the same cash twice", async () => {
  const w = makeWorld({ cash: 1000 });
  const attempt = () => executeOrder({ userId: U, name: "TCS", qty: 8, mode: "BUY" }, deps(w, 100)).then(() => "ok", (e) => e.message);
  const results = await Promise.all([attempt(), attempt()]);
  assert.deepEqual(results.sort(), ["Insufficient funds", "ok"]);
  assert.equal(w.FundsModel.docs[0].availableCash, 200);
  assert.equal(w.HoldingsModel.docs.reduce((t, h) => t + h.qty, 0), 8);
});

test("an unavailable live quote blocks the order instead of using a stale price", async () => {
  const w = makeWorld();
  const failing = async () => { throw new ServiceError(503, "A live market price is unavailable"); };
  await assert.rejects(executeOrder({ userId: U, name: "TCS", qty: 1, mode: "BUY" }, deps(w, 100, { getFreshQuote: failing })), (e) => e.status === 503);
  assert.equal(w.OrdersModel.docs.length, 0);
});

test("with a replica set the work runs inside a transaction session", async () => {
  const w = makeWorld();
  const calls = [];
  const startSession = async () => ({
    withTransaction: async (fn) => { calls.push("begin"); await fn(); calls.push("commit"); },
    endSession: async () => { calls.push("end"); },
  });
  await executeOrder({ userId: U, name: "TCS", qty: 1, mode: "BUY" }, deps(w, 100, { supportsTransactions: () => true, startSession }));
  assert.deepEqual(calls, ["begin", "commit", "end"]);
  assert.equal(w.OrdersModel.docs.length, 1);
});

test("input validation", () => {
  assert.throws(() => validateOrderInput({ name: "TCS", qty: 1.5, mode: "BUY" }), ServiceError);
  assert.throws(() => validateOrderInput({ name: "TCS", qty: 0, mode: "BUY" }), ServiceError);
  assert.throws(() => validateOrderInput({ name: "FAKECO", qty: 1, mode: "BUY" }), /supported instrument/);
  assert.throws(() => validateOrderInput({ name: "TCS", qty: 1, mode: "SHORT" }), /BUY or SELL/);
  assert.deepEqual(validateOrderInput({ name: " tcs.ns ", qty: "3", mode: "buy" }), { name: "TCS", qty: 3, mode: "BUY" });
});
