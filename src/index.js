const express = require("express");
const connectDB = require("./Database/connect");
const { logTrade, monitorTrade } = require("./Trade/tradeHandler");
const { config } = require("./Utils/config");
const { placeOrder } = require("./Trade/execute");
const { getPendingTrades } = require("./Database/transactions");
const fetchTokens = require("./DexApi/fetchtoken");
const Trade = require("./Database/models/Trade");

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

    // === Continuous token fetch and trade placement ===
    setInterval(async () => {
      try {
        const tokens = await fetchTokens();
        console.log('fetched')
        console.log("📥 Tokens fetched:", tokens);

        for (const token of tokens) {
          // ✅ Example condition: trade only tokens with "USDT" in symbol
          if (!token.includes("USDT")) continue;

          console.log(`📌 Considering trade for ${token}`);
          
          // Place order
          const order = await placeOrder(
            token.symbol,
            "BUY",
            0.001, // trade size (adjust)
            config.MEXC_API_KEY,
            config.MEXC_SECRET_KEY
          );

          if (order) {
            console.log("✅ Order executed:", order);

            // Save executed order in DB
            await logTrade({
              symbol: order.symbol || token.symbol,
              side: order.side || "BUY",
              amount: order.amount || 0.001,
              price: order.price || token.price || 50000,
              stopLoss: (token.price || 50000) * 0.95, // 5% SL
              takeProfit: (token.price || 50000) * 1.05, // 5% TP
              status: "OPEN",
              orderId: order.orderId || null,
            });

            console.log("📝 Trade logged to DB");
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
        const currentPrice = t.price + Math.random() * 2000 - 1000;

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
