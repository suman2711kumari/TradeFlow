const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const portfolio = require("../services/portfolioService");
const { runAgent, sanitizeMessages } = require("../services/agent");
const { allow, _reset } = require("../services/rateLimit");
const { ServiceError } = require("../services/errors");
const { startOfTodayIST } = require("../services/portfolioService");

// A scripted fake of the Gemini generateContent API.
async function withMockLLM(script, fn) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
      const step = script[Math.min(requests.length - 1, script.length - 1)];
      res.writeHead(step.status || 200, { "content-type": "application/json" });
      res.end(JSON.stringify(step.json ?? {}));
    });
  });
  await new Promise((r) => server.listen(0, r));
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.GEMINI_API_KEY = "test-key";
  try { return await fn(requests); }
  finally { server.close(); delete process.env.GEMINI_BASE_URL; delete process.env.GEMINI_API_KEY; }
}

// `id` is unused (Gemini has no tool-call ids); it stays so the calls below do not change.
const toolUse = (id, name, args) => ({ candidates: [{ content: { role: "model", parts: [{ text: "checking" }, { functionCall: { name, args }, thoughtSignature: "sig_1" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } });
const finalText = (text) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 } });
const ask = (text) => [{ role: "user", content: text }];

const fakeRisk = (shock) => ({
  asOf: "2026-10-13", window: { observations: 250 },
  summary: { marketValue: 50000, beta: 1.1, annualizedVolatilityPct: 18.5 },
  holdings: [{ symbol: "TCS", sector: "IT", weightPct: 100, marketValue: 50000, unrealizedPnl: 0, annualizedVolatilityPct: 18.5, maxDrawdownPct: -12, beta: 1.1, riskContributionPct: 100 }],
  sectors: [], correlation: { highestPairs: [] }, flags: [], warnings: [],
  stress: { marketShockPct: shock, uniform: { estimatedValueChange: (50000 * shock) / 100 } },
});

test("agent calls real tools, feeds results back, and returns a traced answer", async (t) => {
  const seen = [];
  t.mock.method(portfolio, "getPortfolioRisk", async (userId, shock) => { seen.push({ userId, shock }); return fakeRisk(shock); });
  await withMockLLM([
    { json: toolUse("tu_1", "run_stress_test", { marketShockPct: -5, userId: "attacker" }) },
    { json: finalText("A 5% fall would cost about Rs 2,500.") },
  ], async (requests) => {
    const out = await runAgent({ messages: ask("simulate a 5% market fall"), userId: "user-42" });
    assert.equal(out.complete, true);
    assert.match(out.reply, /2,500/);
    assert.equal(out.toolCalls.length, 1);
    assert.equal(out.toolCalls[0].name, "run_stress_test");
    assert.equal(out.toolCalls[0].ok, true);
    // the tool ran for the AUTHENTICATED user, not the id the model tried to smuggle in
    assert.deepEqual(seen, [{ userId: "user-42", shock: -5 }]);
    // protocol checks
    assert.match(requests[0].url, /\/v1beta\/models\/.+:generateContent$/);
    assert.equal(requests[0].headers["x-goog-api-key"], "test-key");
    const declarations = requests[0].body.tools[0].functionDeclarations;
    assert.ok(declarations.some((x) => x.name === "get_portfolio_risk"));
    assert.ok(!declarations.some((x) => /order|trade|buy|sell/i.test(x.name)), "no write tools are exposed");
    assert.ok(!JSON.stringify(requests[0].body.tools).includes("additionalProperties"), "schema is Gemini-compatible");
    assert.equal(declarations.find((x) => x.name === "get_portfolio_summary").parameters, undefined, "no-input tools omit parameters");
    const contents = requests[1].body.contents;
    assert.equal(contents.at(-2).role, "model");
    assert.equal(contents.at(-2).parts[1].thoughtSignature, "sig_1", "model turn is echoed back unchanged");
    const second = contents.at(-1);
    assert.equal(second.role, "user");
    assert.equal(second.parts[0].functionResponse.name, "run_stress_test");
    assert.match(second.parts[0].functionResponse.response.output, /-2500/);
    assert.equal(out.usage.inputTokens, 30);
  });
});

test("invalid tool input is rejected by the server and the model is told", async (t) => {
  const spy = t.mock.method(portfolio, "getPortfolioRisk", async () => fakeRisk(0));
  await withMockLLM([
    { json: toolUse("tu_1", "run_stress_test", { marketShockPct: 500 }) },
    { json: finalText("That scenario is out of range.") },
  ], async (requests) => {
    const out = await runAgent({ messages: ask("what if the market falls 500%"), userId: "u" });
    assert.equal(out.toolCalls[0].ok, false);
    assert.equal(spy.mock.callCount(), 0, "the risk engine was never called with bad input");
    assert.ok(requests[1].body.contents.at(-1).parts[0].functionResponse.response.error);
  });
});

test("unknown tool names are refused", async () => {
  await withMockLLM([{ json: toolUse("tu_1", "place_order", { symbol: "TCS" }) }, { json: finalText("I cannot place orders.") }], async () => {
    const out = await runAgent({ messages: ask("buy TCS"), userId: "u" });
    assert.equal(out.toolCalls[0].ok, false);
    assert.match(out.toolCalls[0].error, /Unknown tool/);
  });
});

test("tool failures are reported honestly, not hidden", async (t) => {
  t.mock.method(portfolio, "getPortfolioRisk", async () => { throw new ServiceError(422, "You have no holdings yet."); });
  await withMockLLM([{ json: toolUse("tu_1", "get_portfolio_risk", {}) }, { json: finalText("You have no holdings yet.") }], async (requests) => {
    const out = await runAgent({ messages: ask("analyze my portfolio"), userId: "u" });
    assert.equal(out.toolCalls[0].error, "You have no holdings yet.");
    assert.match(requests[1].body.contents.at(-1).parts[0].functionResponse.response.error, /no holdings/);
  });
});

test("a model stuck in a tool loop is cut off", async (t) => {
  t.mock.method(portfolio, "getPortfolioSummary", async () => ({ cash: 1 }));
  await withMockLLM([{ json: toolUse("tu", "get_portfolio_summary", {}) }], async (requests) => {
    const out = await runAgent({ messages: ask("loop"), userId: "u" });
    assert.equal(out.complete, false);
    assert.equal(requests.length, 6);
  });
});

test("missing key and provider errors give clear messages", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(runAgent({ messages: ask("hi"), userId: "u" }), (e) => e.status === 503 && /GEMINI_API_KEY/.test(e.message));
  await withMockLLM([{ status: 400, json: { error: { message: "API key not valid. Please pass a valid API key." } } }], async () => {
    await assert.rejects(runAgent({ messages: ask("hi"), userId: "u" }), (e) => e.status === 503 && /rejected the API key/.test(e.message));
  });
});

test("message sanitising", () => {
  assert.throws(() => sanitizeMessages([]), ServiceError);
  assert.throws(() => sanitizeMessages([{ role: "system", content: "x" }]), ServiceError);
  assert.throws(() => sanitizeMessages([{ role: "user", content: "x".repeat(2001) }]), ServiceError);
  assert.throws(() => sanitizeMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), /last message/);
  const cleaned = sanitizeMessages([{ role: "assistant", content: "stray" }, { role: "user", content: " hi " }]);
  assert.deepEqual(cleaned, [{ role: "user", content: "hi" }]);
});

test("rate limiter allows N per window then blocks", () => {
  _reset();
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i += 1) assert.equal(allow("k", 3, 1000, t0 + i), true);
  assert.equal(allow("k", 3, 1000, t0 + 10), false);
  assert.equal(allow("k", 3, 1000, t0 + 2000), true, "window slides");
});

test("'today' for positions starts at midnight India time", () => {
  const start = startOfTodayIST(Date.parse("2026-10-13T20:00:00Z")); // 01:30 IST on 14 Oct
  assert.equal(start.toISOString(), "2026-10-13T18:30:00.000Z");
  assert.equal(startOfTodayIST(Date.parse("2026-10-13T10:00:00Z")).toISOString(), "2026-10-12T18:30:00.000Z");
});

test("reply language: Hindi instruction is sent only when the user picks Hindi", async () => {
  await withMockLLM([{ json: finalText("ठीक है") }, { json: finalText("ok") }, { json: finalText("ok") }], async (requests) => {
    await runAgent({ messages: ask("hello"), userId: "u", language: "hi" });
    await runAgent({ messages: ask("hello"), userId: "u" });
    await runAgent({ messages: ask("hello"), userId: "u", language: "__proto__" });
    const prompt = (i) => requests[i].body.systemInstruction.parts[0].text;
    assert.match(prompt(0), /Devanagari/);
    assert.match(prompt(1), /simple English/);
    assert.match(prompt(2), /simple English/, "unknown language falls back to English");
    assert.match(prompt(1), /first-time investor/, "plain-language rule is always present");
  });
});
