import fs from "fs";
import { repoPath } from "./repo-root.js";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function q(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log("\n=== PancakeSwap LP Agent Setup ===\n");

  const rpc = await q("BNB Chain RPC URL (Enter for default BSC): ") || "https://bsc-dataseed.binance.org/";
  const key = await q("Your EVM wallet private key: ");
  const pk = await q("OpenRouter API key: ");
  const model = await q("LLM model (Enter for gpt-4o-mini): ") || "openai/gpt-4o-mini";

  const env = `# === Blockchain ===
RPC_URL=${rpc}
CHAIN_ID=56

# === Wallet ===
WALLET_PRIVATE_KEY=${key}

# === LLM ===
OPENROUTER_API_KEY=${pk}
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=${model}

# === Safety ===
DRY_RUN=true
`;
  fs.writeFileSync(repoPath(".env"), env);
  console.log("\n.env created (DRY_RUN=true - change to false for live trading)\n");

  const deployAmount = await q("Deploy amount per position in USD (Enter for 100): ") || "100";
  const maxPos = await q("Max positions (Enter for 3): ") || "3";
  const minTvl = await q("Min pool TVL in USD (Enter for 50000): ") || "50000";

  const config = {
    deployAmount: Number(deployAmount),
    maxPositions: Number(maxPos),
    minTvl: Number(minTvl),
    deployToken: "BNB",
    minFeeTvlRatio: 0.0001,
    minVolume24h: 10000,
    minTxCount24h: 100,
    feeTiers: [500, 2500],
    stopLossPct: -20,
    takeProfitPct: 10,
    outOfRangeWaitMinutes: 30,
    managementIntervalMin: 10,
    screeningIntervalMin: 30,
  };
  fs.writeFileSync(repoPath("user-config.json"), JSON.stringify(config, null, 2));
  console.log("user-config.json created\n");

  console.log("Setup complete! Run:\n  npm start        (live mode)");
  console.log("  npm run dev      (dry run)\n");
  rl.close();
}

main().catch(console.error);
