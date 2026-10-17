// MongoDB multi-document transactions need a replica set (Atlas, or a local single-node replica set).
// A plain local `mongod` is a standalone server and rejects transactions, so we detect it at startup.
let transactionsSupported = false;

async function detectTransactions(mongoose) {
  if (String(process.env.MONGO_USE_TRANSACTIONS || "").toLowerCase() === "false") {
    transactionsSupported = false;
    return false;
  }
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName) || hello.msg === "isdbgrid";
  } catch (err) {
    console.warn("Could not detect MongoDB topology; assuming no transaction support:", err.message);
    transactionsSupported = false;
  }
  return transactionsSupported;
}

module.exports = {
  detectTransactions,
  supportsTransactions: () => transactionsSupported,
  _set: (value) => { transactionsSupported = value; }, // tests
};
