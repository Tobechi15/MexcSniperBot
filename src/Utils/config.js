require("dotenv").config();

const config = {
    MEXC_API_KEY: process.env.MEXC_API_KEY,
    MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY,
    MONGO_URI: process.env.MONGO_URI,
    PORT: process.env.PORT
}

module.exports = { config };