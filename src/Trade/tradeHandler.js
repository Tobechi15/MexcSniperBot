const axios = require("axios");
const crypto = require("crypto");
const Trade = require("../Database/models/Trade");
const { config } = require("../Utils/config");
const { placeOrder } = require("../Trade/execute"); // ✅ Import placeOrder

/**
 * Generate HMAC SHA256 signature
 */
function createSignature(params, secretKey) {
  const query = new URLSearchParams(params).toString();
  return crypto.createHmac("sha256", secretKey).update(query).digest("hex");
}

/**
 * Fetch available quantity of a symbol's base asset (e.g. BTC from BTCUSDT)
 */
async function fetchBalance(symbol) {
  try {
    const BASE_ACCOUNT_URL = "https://api.mexc.com/api/v3/account";
    const baseAsset = symbol.replace("USDT", ""); // crude parse: works for BTCUSDT, ETHUSDT, etc.
    const params = { timestamp: Date.now() };
    params.signature = createSignature(params, config.MEXC_SECRET_KEY);

    const response = await axios.get(BASE_ACCOUNT_URL, {
      params,
      headers: { "X-MEXC-APIKEY": config.MEXC_API_KEY },
    });

    const balances = response.data.balances || [];
    const asset = balances.find(b => b.asset === baseAsset);

    return asset ? parseFloat(asset.free) : 0;
  } catch (err) {
    console.error("❌ Error fetching balance:", err.response?.data || err.message);
    return 0;
  }
}


/**
 * Log a new trade into MongoDB
 */
async function logTrade({ symbol, side, amount, price, stopLoss, takeProfit, orderId }) {
  const trade = new Trade({
    symbol,
    side,
    amount,
    price,
    stopLoss,
    takeProfit,
    status: "PENDING",
    orderId: orderId || null,
    createdAt: new Date(),
  });

  await trade.save();
  console.log("✅ Trade logged:", {
    id: trade._id,
    symbol: trade.symbol,
    side: trade.side,
    price: trade.price,
    status: trade.status,
  });
  return trade;
}

/**
 * Monitor an active trade for stop-loss/take-profit
 */
async function monitorTrade(trade, currentPrice) {
  if (trade.status !== "OPEN" && trade.status !== "EXECUTED") return;

  console.log(
    `🔍 Monitoring ${trade.symbol} | Side: ${trade.side} | Entry: ${trade.price} | Current: ${currentPrice}`
  );

  // Stop Loss
  if (trade.stopLoss && currentPrice <= trade.stopLoss && trade.side === "BUY") {
    console.log("🚨 Stop Loss triggered for", trade.symbol);
    return await closeTrade(trade, currentPrice, "STOP_LOSS");
  }
  if (trade.stopLoss && currentPrice >= trade.stopLoss && trade.side === "SELL") {
    console.log("🚨 Stop Loss triggered for", trade.symbol);
    return await closeTrade(trade, currentPrice, "STOP_LOSS");
  }

  // Take Profit
  if (trade.takeProfit && currentPrice >= trade.takeProfit && trade.side === "BUY") {
    console.log("🎯 Take Profit triggered for", trade.symbol);
    return await closeTrade(trade, currentPrice, "TAKE_PROFIT");
  }
  if (trade.takeProfit && currentPrice <= trade.takeProfit && trade.side === "SELL") {
    console.log("🎯 Take Profit triggered for", trade.symbol);
    return await closeTrade(trade, currentPrice, "TAKE_PROFIT");
  }
}

/**
 * Close trade by fetching balance and placing opposite order
 */
async function closeTrade(trade, closePrice, reason = "MANUAL") {
  try {
    const oppositeSide = trade.side === "BUY" ? "SELL" : "BUY";
    console.log(`📉 Closing trade ${trade.symbol} with ${oppositeSide}`);

    // ✅ Fetch current balance
    const balanceQty = await fetchBalance(trade.symbol);
    if (balanceQty <= 0) {
      console.error(`⚠️ No balance available to close trade ${trade.symbol}`);
      return null;
    }

    console.log(`📦 Balance available for ${trade.symbol}: ${balanceQty}`);

    // Use minimum of stored amount and actual balance
    const sellAmount = Math.min(trade.amount, balanceQty);

    // Execute opposite order
    const closeOrder = await placeOrder(
      trade.symbol,
      oppositeSide,
      sellAmount,
      config.MEXC_API_KEY,
      config.MEXC_SECRET_KEY
    );

    if (!closeOrder) {
      console.error(`❌ Failed to execute close order for ${trade.symbol}`);
      return null;
    }

    // Update DB
    trade.status = "CLOSED";
    trade.closedAt = new Date();
    const direction = trade.side === "BUY" ? 1 : -1;
    trade.profit = (closePrice - trade.price) * sellAmount * direction;
    trade.closeOrderId = closeOrder.orderId || null;

    await trade.save();

    console.log("✅ Trade closed in DB:", {
      id: trade._id,
      symbol: trade.symbol,
      entry: trade.price,
      exit: closePrice,
      profit: trade.profit,
      reason,
    });

    return trade;
  } catch (err) {
    console.error("❌ Error closing trade:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { logTrade, monitorTrade, closeTrade, fetchBalance };