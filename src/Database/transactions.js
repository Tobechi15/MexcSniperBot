const Trade = require("./models/Trade");

async function getPendingTrades() {
  return await Trade.find({ status: "PENDING" }).sort({
      createdAt: -1,
    });;
}

async function getHistory() {
  return await Trade.find({ status: "CLOSED" }).sort({ closedAt: -1 });
}

// async function add(data) {
//   try {
//     // Validate required fields
//     if (!data.symbol || !data.side || !data.amount || !data.price) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     // Determine trade status
//     const isClosed = data.profit || data.closedAt || data.status === "CLOSED";

//     const newTrade = new Trade({
//       symbol: data.symbol,
//       orderId: data.orderId,
//       side: data.side,
//       amount: data.amount,
//       price: data.price,
//       stopLoss: data.stopLoss,
//       takeProfit: data.takeProfit,
//       profit: data.profit || 0,
//       status: isClosed ? "CLOSED" : "PENDING",
//       closeOrderId: data.closeOrderId,
//       closedAt: isClosed ? (data.closedAt || new Date()) : undefined
//     });

//     await newTrade.save();

//     console.log("✅ New trade added:", newTrade);
//     return newTrade;
//   } catch (error) {
//     console.error("❌ Error adding trade:", error);
//     return null;
//   }
// }

module.exports = { getPendingTrades, getHistory};
