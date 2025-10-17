const fs = require('fs')
const path = require('path')
const crypto = require("crypto");
const { config } = require("../../Utils/config");

const settingsFile = path.join(__dirname, "setting.json");

// === Encryption / Decryption Helpers ===
const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = crypto.createHash("sha256").update(config.ENCRYPTION_SECRET).digest();
const IV_LENGTH = 16;


function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// Decrypt text
function decrypt(encryptedText) {
  const [ivHex, encryptedHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// === File helpers ===
function readSettings() {
  if (!fs.existsSync(settingsFile)) return {};
  const data = fs.readFileSync(settingsFile, "utf8");
  const settings = JSON.parse(data);

  // Decrypt sensitive data before returning
  if (settings.walletAccessKey) settings.walletAccessKey = decrypt(settings.walletAccessKey);
  if (settings.walletSecret) settings.walletSecret = decrypt(settings.walletSecret);

  return settings;
}

function writeSettings(settings) {
  const data = { ...settings };

  // Encrypt sensitive fields before saving
  if (data.walletAccessKey) data.walletAccessKey = encrypt(data.walletAccessKey);
  if (data.walletSecret) data.walletSecret = encrypt(data.walletSecret);

  fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2));
}


module.exports = { readSettings, writeSettings }
