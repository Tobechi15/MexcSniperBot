const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = "https://api.mexc.com/api/v3/order";

/**
 * Generate HMAC SHA256 signature
 */
function createSignature(params, secretKey) {
  const query = new URLSearchParams(params).toString();
  return crypto.createHmac("sha256", secretKey).update(query).digest("hex");
}

/**
 * Place an order (BUY/SELL)
 * @param {string} symbol - Trading pair (e.g., BTCUSDT)
 * @param {string} side - "BUY" or "SELL"
 * @param {number} quantity - Amount to trade
 * @param {string} apiKey - MEXC API Key
 * @param {string} secretKey - MEXC Secret Key
 */
async function placeOrder(symbol, side, quantity, apiKey, secretKey) {
  try {
    let params
    if (side === "BUY") {
      params = {
        symbol,
        side,
        type: "MARKET",
        quoteOrderQty: quantity,
        timestamp: Date.now()
      };
    } else if (side === "SELL") {
      params = {
        symbol,
        side,
        type: "MARKET",
        quantity,
        timestamp: Date.now()
      }
    }
    // Generate signature
    params.signature = createSignature(params, secretKey);

    const response = await axios.post(BASE_URL, null, {
      params,
      headers: { "X-MEXC-APIKEY": apiKey, "Content-Type": "application/json" },
    });

    const data = response.data;

    // Normalize response for DB logging
    const orderInfo = {
      orderId: data.orderId || null,
      symbol: data.symbol || symbol,
      side: data.side || side,
      price: parseFloat(data.price) || 0,
      executedQty: parseFloat(data.executedQty) || quantity,
      status: data.status || "EXECUTED",
      raw: data, // keep full response for debugging
    };

    console.log("✅ Order Executed:", orderInfo);
    return orderInfo;
  } catch (err) {
    console.error("❌ Order Error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { placeOrder };
