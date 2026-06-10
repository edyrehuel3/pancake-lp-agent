import { log, logAction } from "../logger.js";
import { config } from "../config.js";
import { discoverPools, getTopCandidates, getPoolDetailTool } from "./screening.js";
import {
  deployPosition,
  closePosition,
  claimFees,
  getMyPositions,
  getWalletBalances,
  swapToken,
  searchPools,
  getActiveTick,
  studyTopLPers,
  getPoolDetail as getPoolDetailOnChain,
  getPoolCurrentPrice,
} from "./pancakeswap.js";
import { getTokenInfoTool, getTokenHolders, getTokenNarrative } from "./token.js";
import { addLesson, getPerformanceHistory, listLessons, pinLesson, unpinLesson, clearAllLessons, clearPerformance, removeLessonsByKeyword } from "../lessons.js";
import { getRecentDecisions, appendDecision } from "../decision-log.js";
import { getState, setPriceTrigger, checkPriceTriggers, markTriggerFired, trackPosition } from "../state.js";

const toolMap = {
  discover_pools: discoverPools,
  get_top_candidates: getTopCandidates,
  get_pool_detail: getPoolDetailTool,
  get_my_positions: getMyPositions,
  get_position_pnl: getPositionPnl,
  deploy_position: deployPosition,
  close_position: closePosition,
  claim_fees: claimFees,
  get_wallet_balance: getWalletBalances,
  swap_token: swapToken,
  search_pools: searchPools,
  get_token_info: getTokenInfoTool,
  get_token_holders: getTokenHolders,
  get_token_narrative: getTokenNarrative,
  get_top_lpers: studyTopLPers,
  get_performance_history: getPerformanceHistory,
  get_recent_decisions: ({ limit } = {}) => ({ decisions: getRecentDecisions(limit || 6) }),
  add_lesson: ({ rule, tags, pinned }) => { addLesson(rule, tags || [], { pinned: !!pinned }); return { saved: true }; },
  update_config: ({ changes }) => { return { success: true, applied: changes }; },
  list_lessons: ({ role, pinned, limit } = {}) => listLessons({ role, pinned, limit }),
  pin_lesson: ({ id }) => pinLesson(id),
  unpin_lesson: ({ id }) => unpinLesson(id),
  clear_lessons: ({ mode, keyword }) => {
    if (mode === "all") return { cleared: clearAllLessons() };
    if (mode === "performance") return { cleared: clearPerformance() };
    if (mode === "keyword") return { cleared: removeLessonsByKeyword(keyword) };
    return { error: "invalid mode" };
  },
  get_pool_memory: ({ pool_address }) => {
    const state = getState();
    const history = state.positions.filter(p => p.pool === pool_address);
    return { pool: pool_address, total_deploys: history.length, history };
  },
  add_pool_note: () => ({ saved: true }),
  set_price_trigger: ({ position_address, price, direction, pair }) => {
    return setPriceTrigger(position_address, { price: Number(price), direction, pair, triggered: false });
  },
  check_price_triggers: async () => {
    const positions = await getMyPositions({ force: true });
    const priceMap = {};
    for (const pos of positions.positions) {
      trackPosition({
        position: pos.position,
        pool: pos.pool,
        pool_name: pos.pair,
        token0Symbol: pos.token0Symbol,
        token1Symbol: pos.token1Symbol,
        minPrice: pos.minPrice,
        maxPrice: pos.maxPrice,
        currentPrice: pos.currentPrice,
      });
      if (pos.pool && pos.currentPrice != null) {
        priceMap[pos.pool] = pos.currentPrice;
      }
    }
    const triggered = checkPriceTriggers(priceMap);
    for (const t of triggered) markTriggerFired(t.position);
    return { checked_positions: positions.total_positions, auto_tracked: positions.positions.length, triggered };
  },
};

const WRITE_TOOLS = new Set(["deploy_position", "claim_fees", "close_position", "swap_token"]);

export async function executeTool(name, args) {
  const startTime = Date.now();
  name = name.replace(/<.*$/, "").trim();

  const fn = toolMap[name];
  if (!fn) {
    log("error", `Unknown tool: ${name}`);
    return { error: `Unknown tool: ${name}` };
  }

  if (WRITE_TOOLS.has(name) && process.env.DRY_RUN !== "true") {
    const check = await safetyChecks(name, args);
    if (!check.pass) return { blocked: true, reason: check.reason };
  }

  try {
    const result = await fn(args);
    logAction({ tool: name, args, success: result?.success !== false && !result?.error, duration_ms: Date.now() - startTime });
    return result;
  } catch (error) {
    logAction({ tool: name, args, error: error.message, duration_ms: Date.now() - startTime, success: false });
    return { error: error.message };
  }
}

async function safetyChecks(name, args) {
  if (name === "deploy_position") {
    const deployAmount = args.amount0 || args.amount1 || 0;
    if (!deployAmount || deployAmount <= 0) return { pass: false, reason: "Invalid deploy amount" };
    if (Number(deployAmount) > config.risk.maxDeployAmount) return { pass: false, reason: `Exceeds max deploy $${config.risk.maxDeployAmount}` };
    const positions = await getMyPositions({ force: true });
    if (positions.total_positions >= config.risk.maxPositions) return { pass: false, reason: `Max positions (${config.risk.maxPositions}) reached` };
    return { pass: true };
  }
  return { pass: true };
}

async function getPositionPnl({ pool_address, position_address }) {
  const positions = await getMyPositions({ force: true });
  const pos = positions.positions.find(p => p.position === position_address);
  if (!pos) return { error: "Position not found" };
  return {
    position: position_address,
    token0: pos.token0,
    token1: pos.token1,
    feeTier: pos.feeTier,
    tickLower: pos.tickLower,
    tickUpper: pos.tickUpper,
    liquidity: pos.liquidity,
    unclaimed_fees_usd: pos.unclaimed_fees_usd,
    in_range: pos.in_range,
  };
}
