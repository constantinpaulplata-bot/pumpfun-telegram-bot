import dotenv from "dotenv";
import axios from "axios";
import WebSocket from "ws";
import { isBlacklisted, detectDevDump, antiRugScore } from "./filters.js";

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const PUMP_WS = "wss://pumpportal.fun/api/data/ws";

// -----------------------------------------------------
// TRIMITERE MESAJ TELEGRAM
// -----------------------------------------------------
async function sendMessage(text) {
    try {
        await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,
                text,
                parse_mode: "Markdown"
            }
        );
        console.log("📤 Trimis pe Telegram");
    } catch (e) {
        console.log("❌ Telegram error:", e.response?.data || e.message);
    }
}

// -----------------------------------------------------
// DEXSCREENER FREE API
// -----------------------------------------------------
async function getDexData(mint) {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
        const res = await axios.get(url);

        if (!res.data.pairs || res.data.pairs.length === 0) return null;

        return res.data.pairs[0]; // prima pereche este cea mai relevantă
    } catch (e) {
        console.log("⚠ Dex error:", e.message);
        return null;
    }
}

// -----------------------------------------------------
// CONECTARE LA WEBSOCKET PUMP.FUN
// -----------------------------------------------------
console.log("🔌 Conectare la Pump.fun...");
const ws = new WebSocket(PUMP_WS);

ws.on("open", () => {
    console.log("🟢 Conectat!");
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    console.log("📡 Subscribed la NEW TOKENS!");
});

// -----------------------------------------------------
// LOGICA PRINCIPALĂ — TOKEN NOU
// -----------------------------------------------------
ws.on("message", async (raw) => {
    try {
        const msg = JSON.parse(raw.toString());
        if (!msg.mint || !msg.symbol) return;

        console.log("🎯 TOKEN NOU:", msg.name);

        // ------------------------------
        // FILTRU 1: BLACKLIST
        // ------------------------------
        if (isBlacklisted(msg.name, msg.symbol)) {
            console.log("⚠ Token blocat (blacklist).");
            return;
        }

        // Mesaj inițial rapid
        await sendMessage(`
🚀 *Token NOU pe Pump.fun!*
Name: *${msg.name}*
Symbol: *${msg.symbol}*
Mint: \`${msg.mint}\`
MarketCap: *${msg.marketCapSol || 0} SOL*
        `);

        // Delay scurt—DexScreener are nevoie de 1–3 secunde să indexeze tokenul
        setTimeout(async () => {
            const dex = await getDexData(msg.mint);

            if (!dex) {
                await sendMessage("⚠️ *Fără date DexScreener pentru acest token încă.*");
                return;
            }

            // Extragem valori
            const lp = dex.liquidity?.usd ? dex.liquidity.usd / 100 : 0;
            const volume = dex.volume?.h24 || 0;
            const buys = dex.buys?.h1 || 0;
            const sells = dex.sells?.h1 || 0;

            // ------------------------------
            // FILTRU 2: DEV DUMP
            // ------------------------------
            if (detectDevDump(msg.traderPubkey, msg)) {
                await sendMessage("⚠️ *Dev Dump detectat!* Risc extrem!");
            }

            // ------------------------------
            // SCOR ANTIRUG
            // ------------------------------
            const score = antiRugScore({
                lp,
                volume,
                buys,
                sells,
                mc: msg.marketCapSol || 0
            });

            // ------------------------------
            // MESAJ FINAL ANALIZĂ PRO
            // ------------------------------
            await sendMessage(`
🎯 *Analiză PRO — ${msg.name}*

💎 *Scor Total: ${score}/100*

💧 LP: *${lp.toFixed(2)} SOL*
📈 Volume 24h: *${volume}*
🟢 Buys (1h): *${buys}*
🔴 Sells (1h): *${sells}*

🌐 Pump: https://pump.fun/${msg.mint}
🌐 Dex: https://dexscreener.com/solana/${msg.mint}

${score > 80 ? "🔥 *Extrem de promițător!*" :
  score > 60 ? "✅ *Bun — merită urmărit.*" :
  score > 40 ? "⚠️ *Mediu, riscuri prezente.*" :
  "❌ *Risc ridicat! Fii atent.*"}
            `);

        }, 3000);

    } catch (e) {
        console.log("❌ Parse error:", e.message);
    }
});

// -----------------------------------------------------
// ERROR HANDLING & RECONNECT
// -----------------------------------------------------
ws.on("error", err => console.log("❌ WS error:", err.message));

ws.on("close", () => {
    console.log("🔴 Deconectat. Restart în 5 sec...");
    setTimeout(() => process.exit(1), 5000);
});
