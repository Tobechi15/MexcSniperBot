const axios = require("axios");
const fs = require("fs");

const endpoint = "https://api.mexc.com/api/v3/defaultSymbols";
const storeFile = "symbols.json";

async function fetchTokens() {
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

            if (newTokens.length > 0) {
                console.log("✨ New tokens detected:", newTokens);
                // Save the current symbols
                fs.writeFileSync(storeFile, JSON.stringify(currentSymbols, null, 2));
            }

            return newTokens;
        } else {
            throw new Error("Invalid API response");
        }
    } catch (err) {
        console.error("❌ Error fetching tokens:", err.message);
        return [];
    }
}

module.exports = fetchTokens;
