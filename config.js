import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = __dirname;
export function repoPath(...parts) { return path.join(REPO_ROOT, ...parts); }

dotenvConfig({ path: repoPath(".env") });

const USER_CONFIG_PATH = repoPath("user-config.json");
const u = fs.existsSync(USER_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"))
  : {};

// PancakeSwap v3 contract addresses on BNB Chain
export const PANCAKESWAP = {
  CHAIN_ID: 56,
  V3_FACTORY: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
  V3_NFPM: "0x46A15B0b27311cedF172AB29A4fB6D9F7D4cB3C7",
  V3_ROUTER: "0x1b81D678ffb9C0263b24A97847620C99d213eB14",
  V3_SUBGRAPH: "https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  BUSD_V2: "0x55d398326f99059fF775485246999027B3197955",
};

export const FEE_TIERS = [
  { fee: 100, tickSpacing: 1, label: "0.01%" },
  { fee: 500, tickSpacing: 10, label: "0.05%" },
  { fee: 2500, tickSpacing: 50, label: "0.25%" },
  { fee: 10000, tickSpacing: 200, label: "1%" },
];

export function getRpcUrl() {
  return process.env.RPC_URL || "https://bsc-dataseed.binance.org/";
}

export function getWalletPrivateKey() {
  const key = process.env.WALLET_PRIVATE_KEY;
  if (!key) throw new Error("WALLET_PRIVATE_KEY not set in .env");
  return key;
}

function num(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export const config = {
  risk: {
    maxPositions: u.maxPositions ?? 3,
    maxDeployAmount: u.maxDeployAmount ?? 5000,
  },
  screening: {
    minFeeTvlRatio: u.minFeeTvlRatio ?? 0.0001,
    minTvl: u.minTvl ?? 50000,
    maxTvl: u.maxTvl ?? null,
    minVolume24h: u.minVolume24h ?? 10000,
    minLiquidity: u.minLiquidity ?? 20000,
    minTxCount24h: u.minTxCount24h ?? 100,
    feeTiers: u.feeTiers ?? [500, 2500],
    maxFeeTier: u.maxFeeTier ?? 10000,
    minTokenAgeDays: u.minTokenAgeDays ?? 1,
    maxTokenAgeDays: u.maxTokenAgeDays ?? null,
    blockedTokens: u.blockedTokens ?? [],
  },
  management: {
    stopLossPct: u.stopLossPct ?? -20,
    takeProfitPct: u.takeProfitPct ?? 10,
    trailingTakeProfit: u.trailingTakeProfit ?? true,
    trailingTriggerPct: u.trailingTriggerPct ?? 5,
    trailingDropPct: u.trailingDropPct ?? 2,
    outOfRangeWaitMinutes: u.outOfRangeWaitMinutes ?? 30,
    minSolToOpen: u.minSolToOpen ?? 0.05,
    deployAmount: u.deployAmount ?? 100,
    deployToken: u.deployToken ?? "BNB",
    gasReserve: u.gasReserve ?? 0.02,
    positionSizePct: u.positionSizePct ?? 0.35,
    minClaimUsd: u.minClaimUsd ?? 2,
  },
  strategy: {
    priceRangePct: u.priceRangePct ?? 10,
    strategy: u.strategy ?? "bid_ask",
  },
  schedule: {
    managementIntervalMin: u.managementIntervalMin ?? 10,
    screeningIntervalMin: u.screeningIntervalMin ?? 30,
  },
  llm: {
    temperature: u.temperature ?? 0.373,
    maxTokens: u.maxTokens ?? 4096,
    maxSteps: u.maxSteps ?? 20,
    managementModel: u.managementModel ?? process.env.LLM_MODEL ?? "openai/gpt-4o-mini",
    screeningModel: u.screeningModel ?? process.env.LLM_MODEL ?? "openai/gpt-4o-mini",
    generalModel: u.generalModel ?? process.env.LLM_MODEL ?? "openai/gpt-4o-mini",
  },
  tokens: {
    WBNB: PANCAKESWAP.WBNB,
    USDC: PANCAKESWAP.USDC,
    USDT: PANCAKESWAP.USDT,
  },
};
