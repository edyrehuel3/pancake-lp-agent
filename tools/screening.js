import { config, PANCAKESWAP, FEE_TIERS } from "../config.js";
import { log } from "../logger.js";
import { discoverV3Pools, getPoolDetail } from "./pancakeswap.js";

function scorePool(pool) {
  const feeTvl = pool.tvlUsd > 0 ? (pool.feesUsd / pool.tvlUsd) : 0;
  const volume = pool.volumeUsd || 0;
  const txCount = pool.txCount || 0;
  return feeTvl * 10000 + volume / 1000 + txCount / 10;
}

function passesThresholds(pool) {
  const s = config.screening;
  const feeRatio = pool.tvlUsd > 0 ? (pool.feesUsd / pool.tvlUsd) : 0;

  if (feeRatio < s.minFeeTvlRatio) return { pass: false, reason: `fee/TVL ${feeRatio.toFixed(6)} below min ${s.minFeeTvlRatio}` };
  if (pool.tvlUsd < s.minTvl) return { pass: false, reason: `TVL $${pool.tvlUsd.toLocaleString()} below min $${s.minTvl.toLocaleString()}` };
  if (s.maxTvl && pool.tvlUsd > s.maxTvl) return { pass: false, reason: `TVL $${pool.tvlUsd.toLocaleString()} above max $${s.maxTvl.toLocaleString()}` };
  if (pool.volumeUsd < s.minVolume24h) return { pass: false, reason: `volume $${pool.volumeUsd.toLocaleString()} below min $${s.minVolume24h.toLocaleString()}` };
  if (pool.txCount < s.minTxCount24h) return { pass: false, reason: `tx count ${pool.txCount} below min ${s.minTxCount24h}` };
  if (pool.liquidity === "0") return { pass: false, reason: "no liquidity" };

  const feeTierOk = s.feeTiers.includes(pool.feeTier);
  if (!feeTierOk) return { pass: false, reason: `fee tier ${pool.feeTier} not in allowed tiers ${s.feeTiers.join(",")}` };

  return { pass: true };
}

export async function discoverPools({ page_size = 50 } = {}) {
  const pools = await discoverV3Pools({ limit: page_size });

  const passed = [];
  const filtered = [];

  for (const pool of pools) {
    const check = passesThresholds(pool);
    if (check.pass) {
      passed.push(pool);
    } else {
      if (filtered.length < 5) filtered.push({ name: pool.token0.symbol + "/" + pool.token1.symbol, reason: check.reason });
    }
  }

  passed.sort((a, b) => scorePool(b) - scorePool(a));

  log("screening", `Discovered ${pools.length} pools, ${passed.length} pass thresholds`);

  return {
    total: pools.length,
    pools: passed.slice(0, page_size).map(p => ({
      pool: p.address,
      name: `${p.token0.symbol}/${p.token1.symbol}`,
      token0: p.token0,
      token1: p.token1,
      feeTier: p.feeTier,
      tvl: p.tvlUsd,
      volume: p.volumeUsd,
      txCount: p.txCount,
      feeTvlRatio: p.tvlUsd > 0 ? (p.feesUsd / p.tvlUsd) : 0,
      dayVolume: p.dayData?.volumeUsd || p.volumeUsd,
      dayFees: p.dayData?.feesUsd || p.feesUsd,
      dayTxCount: p.dayData?.txCount || p.txCount,
    })),
    filtered_examples: filtered,
  };
}

export async function getTopCandidates({ limit = 5 } = {}) {
  const discovery = await discoverPools({ page_size: 50 });
  const candidates = discovery.pools
    .filter(p => {
      if (p.tvl < config.screening.minTvl) return false;
      if (config.screening.maxTvl && p.tvl > config.screening.maxTvl) return false;
      if (p.feeTvlRatio < config.screening.minFeeTvlRatio) return false;
      return true;
    })
    .slice(0, limit);

  return { candidates, total_screened: discovery.total, filtered_examples: discovery.filtered_examples };
}

export async function getPoolDetailTool({ pool_address, timeframe = "24h" }) {
  const onchain = await getPoolDetail(pool_address);
  if (!onchain) throw new Error(`Pool ${pool_address} not found`);

  const subgraph = await discoverV3Pools({ limit: 1 });
  const fromSubgraph = subgraph.find(p => p.address?.toLowerCase() === pool_address.toLowerCase());

  return {
    ...onchain,
    tvlUsd: fromSubgraph?.tvlUsd || 0,
    volumeUsd: fromSubgraph?.volumeUsd || 0,
    txCount: fromSubgraph?.txCount || 0,
    dayData: fromSubgraph?.dayData || null,
  };
}
