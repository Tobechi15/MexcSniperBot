const mongoose = require("mongoose");

const TradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  side: { type: String, enum: ["BUY", "SELL"], required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ["PENDING", "CLOSED"], default: "PENDING" },
  profit: { type: Number, default: 0 },
  stopLoss: { type: Number },
  takeProfit: { type: Number },
  createdAt: { type: Date, default: Date.now },
  closedAt: { type: Date }
});
const Trade = mongoose.model("MEXC", TradeSchema);

module.exports = Trade;
