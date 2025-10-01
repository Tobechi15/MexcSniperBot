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
 * @param {number} amount - Amount (quantity or quote amount depending on type)
 * @param {string} type - "MARKET" or "LIMIT"
 * @param {number} price - Price (only for LIMIT)
 * @param {string} apiKey - MEXC API Key
 * @param {string} secretKey - MEXC Secret Key
 */
async function placeOrder(symbol, side, amount, type, price, apiKey, secretKey) {
  try {
    let params = {
      symbol,
      side,
      type,
      timestamp: Date.now()
    };

    if (type === "MARKET") {
      if (side === "BUY") {
        // BUY MARKET → spend this much USDT
        params.quoteOrderQty = amount;
      } else if (side === "SELL") {
        // SELL MARKET → sell this many base tokens
        params.quantity = amount;
      }
    } else if (type === "LIMIT") {
      params.quantity = amount;
      params.price = price;
    }

    // Generate signature
    params.signature = createSignature(params, secretKey);

    const response = await axios.post(BASE_URL, null, {
      params,
      headers: {
        "X-MEXC-APIKEY": apiKey,
        "Content-Type": "application/json"
      }
    });

    const data = response.data;

    // Normalize response for DB logging
    return {
      orderId: data.orderId || null,
      symbol: data.symbol || symbol,
      side: data.side,
      price: parseFloat(data.price) || 0,
      executedQty: amount,
      status: "PENDING",
      raw: data
    };
  } catch (err) {
    console.error("❌ Order Error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { placeOrder };
