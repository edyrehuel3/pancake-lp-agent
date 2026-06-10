import { config } from "./config.js";
import { log } from "./logger.js";
import { runAgentCycle, chat } from "./agent.js";
import { getWalletBalances, getMyPositions, getWalletAddress } from "./tools/pancakeswap.js";
import { getTopCandidates } from "./tools/screening.js";
import { initTelegram } from "./telegram.js";
import cron from "node-cron";
import readline from "readline";

log("startup", `PancakeSwap LP Agent v1.0.0`);
log("startup", `Chain: BNB Chain (${process.env.CHAIN_ID || 56})`);
log("startup", `RPC: ${process.env.RPC_URL || "default BSC"}`);
log("startup", `Dry run: ${process.env.DRY_RUN === "true" ? "YES" : "NO"}`);

initTelegram();

// Schedule management cycles
cron.schedule(`*/${config.schedule.managementIntervalMin} * * * *`, async () => {
  log("cron", "Starting management cycle...");
  await runAgentCycle({ role: "MANAGER" }).catch(e => log("cron_error", `Manage: ${e.message}`));
});

// Schedule screening cycles
cron.schedule(`*/${config.schedule.screeningIntervalMin} * * * *`, async () => {
  log("cron", "Starting screening cycle...");
  await runAgentCycle({ role: "SCREENER" }).catch(e => log("cron_error", `Screen: ${e.message}`));
});

// Run first cycle after 5s delay
setTimeout(async () => {
  log("agent", "Running initial management cycle...");
  await runAgentCycle({ role: "MANAGER" }).catch(e => log("agent_error", e.message));
}, 5000);

setTimeout(async () => {
  log("agent", "Running initial screening cycle...");
  await runAgentCycle({ role: "SCREENER" }).catch(e => log("agent_error", e.message));
}, 15000);

log("startup", `Scheduling: management every ${config.schedule.managementIntervalMin}m, screening every ${config.schedule.screeningIntervalMin}m`);
log("startup", "Agent is running. Type commands or chat below.");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function handleInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  switch (trimmed) {
    case "/status":
    case "/balance": {
      const [balance, positions] = await Promise.all([getWalletBalances(), getMyPositions()]);
      console.log(`\nWallet: ${getWalletAddress()}`);
      console.log(`BNB: ${balance.sol.toFixed(4)}`);
      console.log(`Open Positions: ${positions.total_positions}`);
      break;
    }
    case "/positions": {
      const positions = await getMyPositions();
      if (positions.total_positions === 0) {
        console.log("No open positions.");
      } else {
        for (const p of positions.positions) {
          console.log(`  #${p.position} | ${p.pair} | Fee: ${p.feeTier / 10000}% | Liquidity: ${(+p.liquidity).toFixed(2)}`);
        }
      }
      break;
    }
    case "/candidates": {
      const result = await getTopCandidates({ limit: 5 });
      if (result.candidates.length === 0) {
        console.log("No eligible pools found.");
      } else {
        for (const p of result.candidates) {
          console.log(`  ${p.name} | TVL: $${(p.tvl || 0).toLocaleString()} | Vol: $${(p.volume || 0).toLocaleString()} | FeeTier: ${p.feeTier / 10000}%`);
        }
      }
      break;
    }
    case "/screen":
      console.log("Running screening cycle...");
      const screenResult = await runAgentCycle({ role: "SCREENER" });
      console.log(screenResult.reasoning || JSON.stringify(screenResult));
      break;
    case "/manage":
      console.log("Running management cycle...");
      const manageResult = await runAgentCycle({ role: "MANAGER" });
      console.log(manageResult.reasoning || JSON.stringify(manageResult));
      break;
    case "/help":
      console.log(`
Commands:
  /status      Wallet balance + positions
  /positions   List open positions
  /candidates  Top pool candidates
  /screen      Run screening now
  /manage      Run management now
  /help        This help
  /stop        Shutdown
  <anything>   Chat with the agent
      `);
      break;
    case "/stop":
      console.log("Shutting down...");
      rl.close();
      process.exit(0);
      break;
    default:
      if (trimmed.startsWith("/")) {
        console.log("Unknown command. Type /help");
      } else {
        const resp = await chat(trimmed);
        console.log(resp);
      }
  }
}

rl.on("line", async (input) => {
  try {
    await handleInput(input);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
  rl.prompt();
});

rl.prompt();
console.log("Type /help for commands");
