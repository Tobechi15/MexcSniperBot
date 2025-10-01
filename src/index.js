const express = require("express");
const connectDB = require("./Database/connect");
const { logTrade, monitorTrade } = require("./Trade/tradeHandler");
const { config } = require("./Utils/config");
const { placeOrder } = require("./Trade/execute");
const { getPendingTrades } = require("./Database/transactions");
const fetchTokens = require("./DexApi/fetchtoken");
const Trade = require("./Database/models/Trade");
const getPrice = require("./DexApi/getPrice");
const sendTelegramMessage = require("./DexApi/alert");

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());

/**
 * Routes
 */

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Sniper Bot running 🚀" });
});

// Pending trades
app.get("/pending", async (req, res) => {
  try {
    const trades = await getPendingTrades();
    res.json({ count: trades.length, trades });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending trades" });
  }
});

// Trade history
app.get("/history", async (req, res) => {
  try {
    const history = await Trade.find({ status: "CLOSED" }).sort({
      closedAt: -1,
    });
    res.json({ count: history.length, history });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trade history" });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`✅ Express server running on port ${PORT}`);

  try {
    // Connect database
    await connectDB();

    console.log("🚀 Sniper Bot Started");
    await fetchTokens();
    const limit = 1;
    let count = 0;

    // === Continuous token fetch and trade placement ===
    setInterval(async () => {
      try {
        const tokens = await fetchTokens();


        for (const token of tokens) {
          // ✅ Example condition: trade only tokens with "USDT" in symbol
          if (!token.includes("USDT")) continue;

          console.log(`📌 Considering trade for ${token}`);

          if (count < limit) {
            // Place order
            const order = await placeOrder(
              token,
              "BUY",
              1, // trade size (adjust)
              config.MEXC_API_KEY,
              config.MEXC_SECRET_KEY
            );

            if (order) {
              console.log("✅ Order executed:", order);
              sendTelegramMessage(`🚀 New Trade Executed: ${token} at ${order.price}`);

              // Save executed order in DB
              await logTrade({
                symbol: order.symbol,
                side: order.side,
                amount: order.origQty,
                price: order.price,
                stopLoss: (order.price) * 0.50, // 50% SL
                takeProfit: (order.price) * 1.50, // 50% TP
                orderId: order.orderId,
              });

              console.log("📝 Trade logged to DB");
              count++;
            }
          }
        }
      } catch (err) {
        console.error("❌ Error in token fetch loop:", err.message);
      }
    }, 1 * 1000); // every 60 seconds

    // === Monitor trades every 30s ===
    setInterval(async () => {
      const pendingTrades = await getPendingTrades();

      for (const t of pendingTrades) {
        // Simulated price feed (replace with real price API)
        const currentPrice = getPrice(t.symbol)

        console.log(
          `📊 Monitoring trade ${t.symbol} | Entry: ${t.price} | Current: ${currentPrice}`
        );

        await monitorTrade(t, currentPrice);
      }
    }, 30 * 1000);
  } catch (error) {
    console.error("❌ Fatal error in bot logic:", error.message);
  }
});
