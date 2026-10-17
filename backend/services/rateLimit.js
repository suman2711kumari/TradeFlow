// Tiny in-memory sliding-window limiter, keyed by user id. Protects the paid LLM API from runaway use.
const hits = new Map();

function allow(key, limit = 20, windowMs = 60 * 60 * 1000, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

module.exports = { allow, _reset: () => hits.clear() };
