const axios = require("axios");
const fs = require("fs");

const endpoint = "https://api.mexc.com/api/v3/defaultSymbols";
const priceEndpoint = "https://api.mexc.com/api/v3/klines";
const storeFile = "symbols.json";
const pendingFile = "pendingTokens.json";

/* ---------- Utility Functions ---------- */
function readJSON(file) {
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : [];
  } catch {
    console.error(`⚠️ Corrupted file detected: ${file}. Resetting...`);
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify([...new Set(data)], null, 2));
}

/* ---------- Core Checks ---------- */
async function hasPriorPrice(symbol) {
  try {
    const endTime = Date.now();
    const startTime = endTime - 6 * 60 * 60 * 1000;
    const url = `${priceEndpoint}?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=10`;
    const res = await axios.get(url);
    return Array.isArray(res.data) && res.data.length > 0;
  } catch (err) {
    console.error(`⚠️ Error checking price for ${symbol}: ${err.message}`);
    return false;
  }
}

async function isTradingEnabled(symbol) {
  try {
    const res = await axios.get(
      `https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`
    );
    const data = res.data;
    return parseFloat(data.volume) > 0 && parseFloat(data.lastPrice) > 0;
  } catch {
    return false;
  }
}

/* ---------- Fetch Tokens ---------- */
async function fetchTokens(checkHistory = true, onStart = false) {
  try {
    const response = await axios.get(endpoint);
    if (!response.data || response.data.code !== 0)
      throw new Error("Invalid API response");

    const currentSymbols = response.data.data;

    if (onStart) {
      // On start: just snapshot current tokens
      writeJSON(storeFile, currentSymbols);
      console.log(`📦 Snapshot taken. Total tokens: ${currentSymbols.length}`);
      return [];
    }

    const previousSymbols = readJSON(storeFile);
    const pendingTokens = readJSON(pendingFile);

    // Detect newly listed tokens
    const newTokens = currentSymbols.filter(
      (sym) => !previousSymbols.includes(sym)
    );

    // Combine both for evaluation
    const tokensToCheck = [...new Set([...pendingTokens, ...newTokens])];

    const tradableTokens = [];
    const stillPending = [];

    for (const token of tokensToCheck) {
      if (checkHistory) {
        const hadPriceBefore = await hasPriorPrice(token);
        if (hadPriceBefore) {
          console.log(`🚫 Skipping ${token} — prior price detected.`);
          continue;
        }
      }

      const tradable = await isTradingEnabled(token);
      if (tradable) {
        tradableTokens.push(token);
        console.log(`✅ ${token} is now tradable.`);
      } else {
        stillPending.push(token);
      }
    }

    writeJSON(storeFile, currentSymbols);
    writeJSON(pendingFile, stillPending);

    if (tradableTokens.length > 0)
      console.log("✨ Tradable tokens found:", tradableTokens);

    return tradableTokens;
  } catch (err) {
    console.error("❌ Error fetching tokens:", err.message);
    return [];
  }
}

module.exports = { fetchTokens, hasPriorPrice, isTradingEnabled };
