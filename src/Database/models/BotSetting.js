const mongoose = require("mongoose");

const botSettingSchema = new mongoose.Schema({
  takeProfit: { type: Number, required: true },  // in %
  stopLoss: { type: Number, required: true },    // in %
  buyAmount: { type: Number, required: true },   // trade size
  walletAccessKey: { type: String, required: true },
  walletSecret: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("BotSetting", botSettingSchema);
