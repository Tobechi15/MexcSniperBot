const express = require("express");
const connectDB = require("./Database/connect");
const { logTrade, monitorTrade } = require("./Trade/tradeHandler");
const { config } = require("./Utils/config");
const { placeOrder } = require("./Trade/execute");
const { getPendingTrades, getHistory, add } = require("./Database/transactions");
const { fetchTokens, isTradingEnabled } = require("./DexApi/fetchtoken");
const Trade = require("./Database/models/Trade");
const getPrice = require("./DexApi/getPrice");
const sendTelegramMessage = require("./DexApi/alert");
const { readSettings, writeSettings } = require("./Database/models/BotSetting");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;
const PASSWORD = "pass";
const EMAIL = "testintel2005@gmail.com";

// Middleware
app.use(express.json());
app.use(cors());

// === Trade limit per run (adjust as needed) ===
const TRADE_LIMIT = 1;
let tradeCount = 0;
/**
 * Routes
 */

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Sniper Bot running 🚀" });
});

// POST /api/trades - Add a new trade
app.post("/add", async (req, res) => {
  try {
    const {
      symbol,
      side,
      amount,
      price,
    } = req.body;

    // Validate required fields
    if (!symbol || !side || !amount || !price) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const data = req.body;

    const newTrade = await add(data);

    if (!newTrade) {
      return res.status(400).json({ error: "Failed to add trade" });
    }
    res.status(201).json({ message: "Trade added successfully", trade: newTrade });
  } catch (error) {
    console.error("Error adding trade:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post('/settings', (req, res) => {
  const { takeProfit, stopLoss, buyAmount, currency, walletAccessKey, walletSecret } = req.body
  const settings = {
    takeProfit,
    stopLoss,
    buyAmount,
    currency,
    walletAccessKey,
    walletSecret,
    createdAt: new Date().toISOString()
  };

  writeSettings(settings)
  res.json({ status: "success", message: "Settings saved", settings });

});

// Retrieve settings (decrypted)
app.get("/settings", (req, res) => {
  const settings = readSettings();
  res.json(settings);
});

// === Authentication ===
// POST /auth - verify password and return settings
app.post("/auth", (req, res) => {
  const { password } = req.body;
  if (password !== PASSWORD) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const settings = readSettings();
  res.json(settings);
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (password !== PASSWORD || email !== EMAIL) {
    return res.status(401).json({ message: "Invalid password" });
  }

  res.json({ status: "ok", message: "Login successful" });
});

// ✅ Close a pending trade by ID
app.post("/close/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { closePrice, closeOrderId } = req.body;

    // Validate input
    if (!closePrice) {
      return res.status(400).json({ error: "Missing closePrice in request body" });
    }

    // Find the trade
    const trade = await Trade.findById(id);
    if (!trade) {
      return res.status(404).json({ error: "Trade not found" });
    }

    if (trade.status === "CLOSED") {
      return res.status(400).json({ error: "Trade is already closed" });
    }

    // Compute profit (assuming BUY → profit = close - entry, SELL → entry - close)
    let profit = 0;
    if (trade.side === "BUY") {
      profit = (closePrice - trade.price) * trade.amount;
    } else if (trade.side === "SELL") {
      profit = (trade.price - closePrice) * trade.amount;
    }

    // Update trade record
    trade.status = "CLOSED";
    trade.profit = profit;
    trade.closeOrderId = closeOrderId || `CLOSE-${Date.now()}`;
    trade.closedAt = new Date();

    await trade.save();

    res.json({
      message: "Trade closed successfully",
      trade,
    });
  } catch (error) {
    console.error("Error closing trade:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Sniper Bot is Healthy" });
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
  console.log(`Express server running on port ${PORT}`);
  try {
    // 1️⃣ Connect to database
    await connectDB();

    // 2️⃣ Initial token snapshot (no trades executed)
    console.log("Sniper Bot Started");
    await fetchTokens(false, true);


    // 3️⃣ Continuous token fetch & pending management
    setInterval(async () => {
      try {
        const tradableTokens = await fetchTokens(true, false); // fetch tradable & update pending automatically

        if (tradableTokens.length === 0) {
          return;
        }

        console.log(` Tradable tokens ready for execution: ${tradableTokens.join(", ")}`);

        // 4️⃣ Execute trades for tokens that are now tradable
        for (const token of tradableTokens) {
          // Example: Only trade USDT pairs
          if (!token.includes("USDT")) continue;

          sendTelegramMessage(`📌 new token discovered ${token} pls compare time`);

          if (tradeCount >= TRADE_LIMIT) {
            console.log("⚠️ Trade limit reached for this interval.");
            break;
          }

          try {
            const order = await placeOrder(
              token,
              "BUY",
              1, // Trade amount (adjust)
              "MARKET",
              0, // Price (not needed for MARKET)
              config.MEXC_API_KEY,
              config.MEXC_SECRET_KEY
            );

            if (order) {
              console.log(`🚀 Trade executed for ${token} at ${order.price}`);
              sendTelegramMessage(`🚀 Trade executed: ${token} at ${order.price}`);

              // 5️⃣ Log trade to DB
              await logTrade({
                symbol: order.symbol,
                side: order.side,
                amount: order.executedQty,
                price: order.price,
                stopLoss: order.price * 0.20,
                takeProfit: order.price * 1.05,
                orderId: order.orderId,
              });

              tradeCount++;
            }
          } catch (err) {
            console.error(`⚠️ Failed to execute trade for ${token}:`, err.message);
          }
        }
      } catch (err) {
        console.error("❌ Error in token fetch loop:", err.message);
      }
    }, 1 * 1000); // Repeat every 1 seconds

    // 6️⃣ Monitor active trades
    setInterval(async () => {
      const activeTrades = await getPendingTrades();

      for (const trade of activeTrades) {
        const currentPrice = await getPrice(trade.symbol);
        await monitorTrade(trade, currentPrice);
      }
    }, 2 * 1000); // Check every 2 seconds
  } catch (error) {
    console.error("❌ Fatal error in bot:", error.message);
  }
});
