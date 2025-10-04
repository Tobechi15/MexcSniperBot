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

app.use(express.json());

// === API Endpoints ===
app.get("/", (req, res) => res.json({ status: "ok", message: "Sniper Bot running 🚀" }));
app.get("/health", (req, res) => res.json({ status: "ok", message: "Sniper Bot running 🚀" }));
app.get("/pending", async (req, res) => res.json({ trades: await getPendingTrades() }));
app.get("/history", async (req, res) => res.json({ history: await Trade.find({ status: "CLOSED" }).sort({ closedAt: -1 }) }));

// === Start server ===
app.listen(PORT, async () => {
  console.log(`✅ Express server running on port ${PORT}`);

  try {
    await connectDB();
    console.log("🚀 Sniper Bot Started");

    let count = 0;
    const limit = 1; // how many trades you allow

    // ✅ Subscribe to real-time tokens via WebSocket
    fetchTokens(async (newTokens) => {
      for (const token of newTokens) {
        if (!token.includes("USDT")) continue; // filter

        console.log(`📌 Considering trade for ${token}`);

        if (count < limit) {
          console.log(`🚀 Executing trade for ${token}`);
          // const order = await placeOrder(
          //   token,
          //   "BUY",
          //   1,
          //   config.MEXC_API_KEY,
          //   config.MEXC_SECRET_KEY
          // );

          // if (order) {
          //   console.log("✅ Order executed:", order);
          //   sendTelegramMessage(`🚀 New Trade Executed: ${token} at ${order.price} amount ${order.executedQty} USDT`);

          //   await logTrade({
          //     symbol: order.symbol,
          //     side: order.side,
          //     amount: order.executedQty,
          //     price: order.price,
          //     stopLoss: order.price * 0.50,
          //     takeProfit: order.price * 1.05,
          //     orderId: order.orderId,
          //   });

          //   console.log("📝 Trade logged to DB");
          //   count++;
          // }
        }
      }
    });

    // Monitor trades every 30s
    setInterval(async () => {
      const pendingTrades = await getPendingTrades();
      for (const t of pendingTrades) {
        const currentPrice = getPrice(t.symbol);
        console.log(`📊 Monitoring trade ${t.symbol} | Entry: ${t.price} | Current: ${currentPrice}`);
        await monitorTrade(t, currentPrice);
      }
    }, 30 * 1000);

  } catch (err) {
    console.error("❌ Fatal error in bot logic:", err.message);
  }
});
