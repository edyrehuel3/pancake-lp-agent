import { log } from "./logger.js";

let _botToken = null;
let _chatId = null;

export function initTelegram() {
  _botToken = process.env.TELEGRAM_BOT_TOKEN;
  _chatId = process.env.TELEGRAM_CHAT_ID;
  if (_botToken && _chatId) log("telegram", "Telegram configured");
  else log("telegram", "Telegram not configured");
}

async function sendMessage(text) {
  if (!_botToken || !_chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${_botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: _chatId, text, parse_mode: "Markdown" }),
    });
  } catch (e) {
    log("telegram_error", `Send failed: ${e.message}`);
  }
}

export async function notifyDeploy(data) {
  const msg = `? *DEPLOYED*\nPair: ${data.pair || "?"}\nAmount: ${data.amountSol || "?"} BNB\nPosition: \`${(data.position || "").slice(0, 12)}...\``;
  await sendMessage(msg);
}

export async function notifyClose(data) {
  const msg = `? *CLOSED*\nPair: ${data.pair || "?"}\nPnL: ${data.pnlUsd ? `$${data.pnlUsd.toFixed(2)}` : "?"} (${data.pnlPct ? `${data.pnlPct.toFixed(2)}%` : "?"})`;
  await sendMessage(msg);
}

export async function notifySwap(data) {
  const msg = `?? *SWAP*\n${data.amountIn} ? ${data.outputSymbol}\nTx: \`${(data.tx || "").slice(0, 12)}...\``;
  await sendMessage(msg);
}
