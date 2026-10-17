// Minimal in-memory stand-in for the few Mongoose operations the order engine uses.
// It is NOT MongoDB: it exists to test our control flow (atomic conditions, rollback, concurrency).
class FakeModel {
  constructor(defaults = {}) { this.docs = []; this.defaults = defaults; this.seq = 0; this.failCreate = false; }
  _match(doc, filter) {
    return Object.entries(filter).every(([k, cond]) => {
      const v = doc[k];
      if (cond && typeof cond === "object") {
        return Object.entries(cond).every(([op, x]) => {
          if (op === "$gte") return v >= x;
          if (op === "$gt") return v > x;
          if (op === "$lte") return v <= x;
          throw new Error(`unsupported operator ${op}`);
        });
      }
      return String(v) === String(cond);
    });
  }
  _apply(doc, update) {
    for (const [k, x] of Object.entries(update.$inc || {})) doc[k] = Math.round((doc[k] + x) * 1e6) / 1e6;
    Object.assign(doc, update.$set || {});
  }
  async findOne(filter) { const d = this.docs.find((x) => this._match(x, filter)); return d ? { ...d } : null; }
  async findOneAndUpdate(filter, update, opts = {}) {
    await Promise.resolve(); // yield, so concurrent callers genuinely interleave
    let doc = this.docs.find((x) => this._match(x, filter));
    if (!doc && opts.upsert) {
      const eq = Object.fromEntries(Object.entries(filter).filter(([, v]) => typeof v !== "object"));
      doc = { _id: `id${++this.seq}`, ...this.defaults, ...eq, ...(update.$setOnInsert || {}) };
      this.docs.push(doc);
    }
    if (!doc) return null;
    const before = { ...doc };
    this._apply(doc, update);
    return opts.new ? { ...doc } : before;
  }
  async updateOne(filter, update) { const d = this.docs.find((x) => this._match(x, filter)); if (d) this._apply(d, update); }
  async create(arr) {
    if (this.failCreate) throw new Error("simulated write failure");
    const made = arr.map((a) => { const d = { _id: `id${++this.seq}`, ...a }; this.docs.push(d); return { ...d }; });
    return made;
  }
  async deleteOne(filter) { const i = this.docs.findIndex((x) => this._match(x, filter)); if (i >= 0) this.docs.splice(i, 1); }
  deleteMany(filter) { this.docs = this.docs.filter((x) => !this._match(x, filter)); return Promise.resolve(); }
}

function makeWorld({ cash = 10000 } = {}) {
  const FundsModel = new FakeModel({ openingBalance: 10000, availableCash: cash });
  const HoldingsModel = new FakeModel();
  const OrdersModel = new FakeModel();
  return { FundsModel, HoldingsModel, OrdersModel };
}

module.exports = { FakeModel, makeWorld };
