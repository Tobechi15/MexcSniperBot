// getPrice.js
const axios = require("axios");

const BASE_URL = "https://api.mexc.com/api/v3/ticker/price";

/**
 * Get latest price for a symbol
 * @param {string} symbol - Trading pair (e.g., BTCUSDT, ETHUSDT)
 */
async function getPrice(symbol) {
  try {
    const response = await axios.get(BASE_URL, {
      params: { symbol },
    });

    const price = parseFloat(response.data.price);
    console.log(`💰 Current price of ${symbol}: ${price}`);
    return price;
  } catch (err) {
    console.error("❌ Error fetching price:", err.response?.data || err.message);
    return null;
  }
}

module.exports = getPrice;
