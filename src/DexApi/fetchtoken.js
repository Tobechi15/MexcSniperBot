const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const protobuf = require("protobufjs");

const WS_URL = "wss://wbs.mexc.com/ws";
const STORE_FILE = path.join(__dirname, "..", "symbols.json");

async function loadProto() {
  const root = await protobuf.load([
    path.join(__dirname, "../protos/PushDataV3ApiWrapper.proto"),
    path.join(__dirname, "../protos/PublicMiniTickersV3Api.proto")
  ]);
  const Wrapper = root.lookupType("PushDataV3ApiWrapper");
  const MiniTicker = root.lookupType("PublicMiniTickersV3Api");
  return { Wrapper, MiniTicker };
}

async function startMiniTickerStream(onNewTokens) {
  const { Wrapper, MiniTicker } = await loadProto();
  let known = new Set();

  if (fs.existsSync(STORE_FILE)) {
    known = new Set(JSON.parse(fs.readFileSync(STORE_FILE, "utf8")));
  }

  function saveKnown() {
    fs.writeFileSync(STORE_FILE, JSON.stringify([...known], null, 2));
  }

  let ws;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      console.log("🌐 Connected to MEXC MiniTickers (protobuf)");
      ws.send(JSON.stringify({
        method: "SUBSCRIPTION",
        params: ["spot@public.miniTickers.v3.api.pb@UTC+8"],
        id: 1
      }));
    });

    ws.on("message", (data, isBinary) => {
      try {
        if (!isBinary) {
          // Control/ACK messages
          const msg = JSON.parse(data.toString());
          if (msg.code === 0 && msg.id) {
            // Subscription successful
            console.log("✅ Subscription ACK:", msg);
          }
          return;
        }

        // Binary message (actual protobuf payload)
        const buf = new Uint8Array(data);
        const wrapper = Wrapper.decode(buf);

        const miniTickersData = wrapper.publicMiniTickers; // field from PushDataV3ApiWrapper
        if (!miniTickersData) return;

        const decodedMini = MiniTicker.decode(miniTickersData.value || miniTickersData);
        if (!decodedMini.tickers || decodedMini.tickers.length === 0) return;

        const newSymbols = [];
        for (const t of decodedMini.tickers) {
          if (!known.has(t.symbol)) {
            known.add(t.symbol);
            newSymbols.push(t.symbol);
          }
        }

        if (newSymbols.length > 0) {
          console.log("✨ New tokens detected:", newSymbols);
          saveKnown();
          if (onNewTokens) onNewTokens(newSymbols);
        }

      } catch (err) {
        console.error("❌ Decode error:", err.message);
      }
    });


    ws.on("close", () => {
      console.warn("⚠️ WebSocket closed, reconnecting soon...");
      setTimeout(connect, 3000);
    });

    ws.on("error", (err) => {
      console.error("❌ WS Error:", err.message);
      ws.close();
    });
  }

  connect();
}

module.exports = startMiniTickerStream;
