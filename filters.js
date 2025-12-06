// ===============================
//  FILTERS PRO PENTRU PUMPFUN BOT
// ===============================

// LISTĂ BLACKLIST - nume toxice, scam, rug-uri frecvente
const blacklistWords = [
    "elon", "musk", "trump", "putin",
    "sex", "porn", "xxx", "fuck",
    "hitler", "nazi",
    "pump", "rug", "scam",
    "shit", "doge", "bonk", "pepe",
];

// ---------------------------------------------
// 1. CHECK IF TOKEN IS BLACKLISTED
// ---------------------------------------------
export function isBlacklisted(name, symbol) {
    if (!name || !symbol) return false;

    const lower = (name + " " + symbol).toLowerCase();

    return blacklistWords.some(w => lower.includes(w));
}

// ---------------------------------------------
// 2. DETECT DEV DUMP (Dacă dev-ul vinde rapid >30% supply în primele minute)
// ---------------------------------------------
export function detectDevDump(traderPubkey, tx) {
    try {
        if (!tx || !tx.initialBuy || !tx.vTokensInBondingCurve) return false;

        const buy = tx.initialBuy;              // cât a cumpărat dev
        const curve = tx.vTokensInBondingCurve; // supply rămas în bonding curve

        const percentDumped = (buy / (buy + curve)) * 100;

        return percentDumped > 30; // dacă vinde peste 30%, risc mare
    } catch {
        return false;
    }
}

// ---------------------------------------------
// 3. ANTI-RUG SCORE — 0..100
// ---------------------------------------------
export function antiRugScore({ lp, volume, buys, sells, mc }) {
    let score = 50;

    // LP
    if (lp > 5) score += 25;
    else if (lp > 2) score += 15;
    else if (lp < 1) score -= 15;

    // Volume
    if (volume > 10000) score += 20;
    else if (volume > 3000) score += 10;
    else score -= 10;

    // Buy/Sell Pressure
    if (buys > sells * 2) score += 15;
    else if (sells > buys * 2) score -= 20;

    // MarketCap
    if (mc > 50) score += 10;

    // Limit score
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return score;
}
