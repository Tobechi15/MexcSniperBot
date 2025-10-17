require("dotenv").config();

const config = {
    MEXC_API_KEY: process.env.MEXC_API_KEY,
    MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY,
    MONGO_URI: process.env.MONGO_URI,
    PORT: process.env.PORT,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID.split(","),
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
}

module.exports = { config };