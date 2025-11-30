import axios from "axios";

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ENDPOINT NOU ȘI FUNCȚIONAL
const API_URL = "https://pumpportal.fun/api/data/launches/recent";


let sentTokens = new Set();

async function sendMessage(text) {
  try {
    await axios.get(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        params: {
          chat_id: CHAT_ID,
          text: text,
          parse_mode: "Markdown"
        }
      }
    );
  } catch (error) {
    console.error("Eroare trimitere mesaj:", error.message);
  }
}

async function checkTokens() {
  try {
    const response = await axios.get(API_URL);
    const tokens = response.data || [];

    for (let token of tokens) {
      const mint = token.mint;

      if (!sentTokens.has(mint)) {
        const msg =
          `🚀 *NOU Token Pump.fun*\n\n` +
          `Name: ${token.name}\n` +
          `Symbol: ${token.symbol}\n` +
          `Creator: ${token.creator}\n` +
          `Mint: \`${mint}\``;

        await sendMessage(msg);
        sentTokens.add(mint);
      }
    }
  } catch (err) {
    console.error("Eroare API Pump.fun:", err.message);
  }
}

console.log("Bot-ul rulează...");

setInterval(checkTokens, 10_000);
