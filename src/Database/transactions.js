const Trade = require("./models/Trade");

async function getPendingTrades() {
  return await Trade.find({ status: "PENDING" });
}

async function getHistory() {
  return await Trade.find({ status: "CLOSED" }).sort({ closedAt: -1 });
}

module.exports = { getPendingTrades, getHistory };
