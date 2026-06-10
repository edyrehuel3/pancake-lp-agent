import { runAgentCycle, chat } from "./agent.js";
import { getWalletBalances, getMyPositions, searchPools, swapToken } from "./tools/pancakeswap.js";
import { discoverPools, getTopCandidates } from "./tools/screening.js";
import { config } from "./config.js";
import { log } from "./logger.js";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "screen":
      const result = await runAgentCycle({ role: "SCREENER" });
      console.log(JSON.stringify(result, null, 2));
      break;
    case "manage":
      const manageResult = await runAgentCycle({ role: "MANAGER" });
      console.log(JSON.stringify(manageResult, null, 2));
      break;
    case "candidates":
      const candidates = await getTopCandidates({ limit: parseInt(args[0] || "5") });
      console.log(JSON.stringify(candidates, null, 2));
      break;
    case "positions":
      const positions = await getMyPositions();
      console.log(JSON.stringify(positions, null, 2));
      break;
    case "balance":
      const balance = await getWalletBalances();
      console.log(JSON.stringify(balance, null, 2));
      break;
    case "search":
      const pools = await searchPools({ query: args[0] || "" });
      console.log(JSON.stringify(pools, null, 2));
      break;
    case "config":
      console.log(JSON.stringify(config, null, 2));
      break;
    case "chat":
      const response = await chat(args.join(" ") || "Hello");
      console.log(response);
      break;
    case "start":
      await startAgent();
      break;
    default:
      console.log(`
PancakeSwap LP Agent CLI

Commands:
  screen       Run one screening cycle
  manage       Run one management cycle
  candidates   List top pool candidates
  positions    List open positions
  balance      Check wallet balance
  search       Search pools by symbol
  config       Show current config
  chat         Chat with the agent
  start        Start autonomous agent

Flags:
  --dry-run    Skip on-chain transactions (set DRY_RUN=true in .env)
      `);
  }
}

async function startAgent() {
  log("agent", "Starting PancakeSwap LP Agent...");
  const { initTelegram } = await import("./telegram.js");
  initTelegram();

  log("agent", "Running initial screening cycle...");
  const screenResult = await runAgentCycle({ role: "SCREENER" });
  console.log("Screening:", JSON.stringify(screenResult, null, 2));

  log("agent", "Running initial management cycle...");
  const manageResult = await runAgentCycle({ role: "MANAGER" });
  console.log("Management:", JSON.stringify(manageResult, null, 2));

  log("agent", "Initial cycles complete. Entering interactive mode.");
  log("agent", `Screening every ${config.schedule.screeningIntervalMin}m, Management every ${config.schedule.managementIntervalMin}m`);

  const cron = (await import("node-cron")).default;
  const readline = (await import("readline")).default;

  cron.schedule(`*/${config.schedule.screeningIntervalMin} * * * *`, async () => {
    log("cron", "Scheduled screening cycle");
    await runAgentCycle({ role: "SCREENER" }).catch(e => log("cron_error", e.message));
  });

  cron.schedule(`*/${config.schedule.managementIntervalMin} * * * *`, async () => {
    log("cron", "Scheduled management cycle");
    await runAgentCycle({ role: "MANAGER" }).catch(e => log("cron_error", e.message));
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => {
    rl.question("\n> ", async (input) => {
      if (input === "/stop" || input === "exit") { rl.close(); process.exit(0); }
      else if (input === "/status") {
        const [b, p] = await Promise.all([getWalletBalances(), getMyPositions()]);
        console.log(`BNB: ${b.sol.toFixed(4)} | Positions: ${p.total_positions}`);
      } else if (input === "/candidates") {
        const c = await getTopCandidates({ limit: 3 });
        c.candidates.forEach(p => console.log(`${p.name} | TVL: $${p.tvl.toLocaleString()} | Vol: $${p.volume.toLocaleString()}`));
      } else if (input.startsWith("/")) {
        console.log("Unknown command. Try: /status, /candidates, /stop");
      } else if (input.trim()) {
        const resp = await chat(input);
        console.log(resp);
      }
      prompt();
    });
  };
  prompt();
}

main().catch(console.error);
