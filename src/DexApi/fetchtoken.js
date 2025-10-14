const axios = require("axios");
const fs = require("fs");

const endpoint = "https://api.mexc.com/api/v3/defaultSymbols";
const priceEndpoint = "https://api.mexc.com/api/v3/klines"; // for checking price history
const storeFile = "symbols.json";

async function hasPriorPrice(symbol) {
    try {
        const endTime = Date.now();
        const startTime = endTime - 6 * 60 * 60 * 1000; // 6 hours range

        const url = `${priceEndpoint}?symbol=${symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=10`;
        const res = await axios.get(url);

        // If any price data exists → token likely relisted
        return Array.isArray(res.data) && res.data.length > 0;
    } catch (err) {
        console.error(`⚠️ Error checking price for ${symbol}:`, err.message);
        return false;
    }
}

async function fetchTokens(checkHistory = true) {
    try {
        const response = await axios.get(endpoint);

        if (response.data && response.data.code === 0) {
            const currentSymbols = response.data.data;

            let previousSymbols = [];
            if (fs.existsSync(storeFile)) {
                previousSymbols = JSON.parse(fs.readFileSync(storeFile, "utf8"));
            }

            // Detect new tokens
            const newTokens = currentSymbols.filter(sym => !previousSymbols.includes(sym));

            let verifiedNewTokens = [];

            if (checkHistory) {
                for (const token of newTokens) {
                    const hadPriceBefore = await hasPriorPrice(token);
                    if (!hadPriceBefore) {
                        verifiedNewTokens.push(token);
                    } else {
                        console.log(`🚫 Skipping ${token} (had price history before launch)`);
                    }
                }
            } else {
                verifiedNewTokens = newTokens; // skip history check
            }

            if (verifiedNewTokens.length > 0) {
                console.log("✨ New tokens detected:", verifiedNewTokens);
                fs.writeFileSync(storeFile, JSON.stringify(currentSymbols, null, 2));
            }

            return verifiedNewTokens;
        } else {
            throw new Error("Invalid API response");
        }
    } catch (err) {
        console.error("❌ Error fetching tokens:", err.message);
        return [];
    }
}

module.exports = fetchTokens;
