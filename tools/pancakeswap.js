import { ethers } from "ethers";
import { config, PANCAKESWAP, getRpcUrl, getWalletPrivateKey } from "../config.js";
import { log } from "../logger.js";
import { trackPosition, recordClaim, recordClose, syncOpenPositions } from "../state.js";
import { recordPerformance } from "../lessons.js";
import { appendDecision } from "../decision-log.js";

let _provider = null;
let _signer = null;
let _walletAddress = null;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(getRpcUrl());
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    const key = getWalletPrivateKey();
    _signer = new ethers.Wallet(key, getProvider());
    _walletAddress = _signer.address;
    log("wallet", `Wallet: ${_walletAddress}`);
  }
  return _signer;
}

export function getWalletAddress() {
  if (!_walletAddress) getSigner();
  return _walletAddress;
}

// ─── ABI snippets ──────────────────────────────────────────────
const NFPM_ABI = [
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256,uint256,uint256)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function increaseLiquidity((uint256,uint256,uint256,uint256,uint256)) returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function decreaseLiquidity((uint256,uint128,uint256,uint256,uint256)) returns (uint256 amount0, uint256 amount1)",
  "function collect((uint256,address,uint128,uint128)) returns (uint256 amount0, uint256 amount1)",
  "function burn(uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function fee() view returns (uint24)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)",
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
  "function feeAmountTickSpacing(uint24 fee) view returns (int24)",
];

const ROUTER_ABI = [
  "function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)",
  "function WETH9() external pure returns (address)",
];

// ─── Helpers ───────────────────────────────────────────────────
function isSameAddress(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
}

export function normalizeAddress(addr) {
  if (!addr) return null;
  return ethers.getAddress(addr.toLowerCase());
}

function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1, token0In = true) {
  const Q96 = BigInt(1) << BigInt(96);
  const ratio = Number(sqrtPriceX96) / Number(Q96);
  const price = ratio * ratio;
  const adjusted = price * (10 ** (token0In ? decimals1 - decimals0 : decimals0 - decimals1));
  return adjusted;
}

function priceToSqrtPriceX96(price, decimals0, decimals1) {
  const Q96 = BigInt(1) << BigInt(96);
  const adjusted = price / (10 ** (decimals1 - decimals0));
  const ratio = Math.sqrt(adjusted);
  return BigInt(Math.floor(ratio * Number(Q96)));
}

function tickToPrice(tick, decimals0, decimals1) {
  return 1.0001 ** tick * (10 ** (decimals1 - decimals0));
}

// ─── Pool Discovery (Subgraph) ─────────────────────────────────
export async function discoverV3Pools({ limit = 50, orderBy = "totalValueLockedUSD", orderDirection = "desc" } = {}) {
  const query = `{
    pools(first: ${limit}, orderBy: ${orderBy}, orderDirection: "${orderDirection}", where: { liquidity_gt: 0 }) {
      id
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      feeTier
      liquidity
      sqrtPrice
      tick
      totalValueLockedUSD
      volumeUSD
      txCount
      feesUSD
      poolDayData(first: 1, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
        txCount
        open
        high
        low
        close
      }
    }
  }`;

  try {
    const res = await fetch(PANCAKESWAP.V3_SUBGRAPH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`Subgraph ${res.status}`);
    const data = await res.json();
    return data.data?.pools?.map(p => ({
      address: normalizeAddress(p.id),
      token0: { address: normalizeAddress(p.token0.id), symbol: p.token0.symbol, decimals: Number(p.token0.decimals) },
      token1: { address: normalizeAddress(p.token1.id), symbol: p.token1.symbol, decimals: Number(p.token1.decimals) },
      feeTier: Number(p.feeTier),
      liquidity: p.liquidity,
      sqrtPrice: p.sqrtPrice,
      tick: Number(p.tick),
      tvlUsd: Number(p.totalValueLockedUSD),
      volumeUsd: Number(p.volumeUSD),
      txCount: Number(p.txCount),
      feesUsd: Number(p.feesUSD),
      dayData: p.poolDayData?.[0] ? {
        volumeUsd: Number(p.poolDayData[0].volumeUSD),
        feesUsd: Number(p.poolDayData[0].feesUSD),
        txCount: Number(p.poolDayData[0].txCount),
      } : null,
    })) || [];
  } catch (error) {
    log("subgraph_error", `Pool discovery: ${error.message}`);
    return [];
  }
}

// ─── Get Pool Detail (on-chain) ────────────────────────────────
export async function getPoolDetail(poolAddress) {
  const pool = new ethers.Contract(normalizeAddress(poolAddress), POOL_ABI, getProvider());
  try {
    const [slot, liq] = await Promise.all([pool.slot0(), pool.liquidity()]);
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    const fee = await pool.fee();
    return {
      address: normalizeAddress(poolAddress),
      token0: normalizeAddress(token0),
      token1: normalizeAddress(token1),
      feeTier: Number(fee),
      tick: Number(slot.tick),
      sqrtPriceX96: slot.sqrtPriceX96.toString(),
      liquidity: liq.toString(),
      unlocked: slot.unlocked,
    };
  } catch (error) {
    log("pool_error", `Pool detail: ${error.message}`);
    return null;
  }
}

// ─── Get Active Tick ────────────────────────────────────────────
export async function getActiveTick(poolAddress) {
  const detail = await getPoolDetail(poolAddress);
  if (!detail) throw new Error(`Pool ${poolAddress} not found`);
  return { tick: detail.tick, sqrtPriceX96: detail.sqrtPriceX96, feeTier: detail.feeTier };
}

// ─── Get Token Info ────────────────────────────────────────────
export async function getTokenInfo(tokenAddress) {
  const token = new ethers.Contract(normalizeAddress(tokenAddress), ERC20_ABI, getProvider());
  try {
    const [symbol, decimals, name] = await Promise.all([
      token.symbol(), token.decimals(), token.name(),
    ]);
    return { address: normalizeAddress(tokenAddress), name, symbol, decimals: Number(decimals) };
  } catch (error) {
    log("token_error", `Token info: ${error.message}`);
    return null;
  }
}

export async function getTokenBalance(tokenAddress, owner = null) {
  const addr = normalizeAddress(tokenAddress);
  const ownerAddr = owner || getWalletAddress();
  if (isSameAddress(addr, PANCAKESWAP.WBNB)) {
    const balance = await getProvider().getBalance(ownerAddr);
    return ethers.formatEther(balance);
  }
  const token = new ethers.Contract(addr, ERC20_ABI, getProvider());
  const balance = await token.balanceOf(ownerAddr);
  const decimals = await token.decimals();
  return ethers.formatUnits(balance, decimals);
}

// ─── Wallet Balance ────────────────────────────────────────────
export async function getWalletBalances() {
  const address = getWalletAddress();
  const bnb = await getProvider().getBalance(address);
  const bnbFormatted = parseFloat(ethers.formatEther(bnb));

  const tokens = [];
  try {
    const usdc = new ethers.Contract(PANCAKESWAP.USDC, ERC20_ABI, getProvider());
    const usdcBal = await usdc.balanceOf(address);
    tokens.push({ symbol: "USDC", mint: PANCAKESWAP.USDC, balance: ethers.formatUnits(usdcBal, 18), usd: parseFloat(ethers.formatUnits(usdcBal, 18)) });
  } catch {}
  try {
    const usdt = new ethers.Contract(PANCAKESWAP.USDT, ERC20_ABI, getProvider());
    const usdtBal = await usdt.balanceOf(address);
    tokens.push({ symbol: "USDT", mint: PANCAKESWAP.USDT, balance: ethers.formatUnits(usdtBal, 18), usd: parseFloat(ethers.formatUnits(usdtBal, 18)) });
  } catch {}

  return { sol: bnbFormatted, tokens };
}

// ─── Get Positions (on-chain via NFPM) ─────────────────────────
export async function getPoolFromTokens(token0, token1, feeTier) {
  const factory = new ethers.Contract(PANCAKESWAP.V3_FACTORY, FACTORY_ABI, getProvider());
  try {
    const poolAddr = await factory.getPool(token0, token1, feeTier);
    if (poolAddr && poolAddr !== "0x0000000000000000000000000000000000000000") {
      return normalizeAddress(poolAddr);
    }
  } catch {}
  return null;
}

export async function getTokenSymbol(addr) {
  try {
    const t = new ethers.Contract(addr, ERC20_ABI, getProvider());
    return await t.symbol();
  } catch { return addr.slice(0, 6); }
}

async function getTokenDecimals(addr) {
  try {
    const t = new ethers.Contract(addr, ERC20_ABI, getProvider());
    return Number(await t.decimals());
  } catch { return 18; }
}

export async function getPoolCurrentPrice(poolAddress) {
  const pool = new ethers.Contract(normalizeAddress(poolAddress), POOL_ABI, getProvider());
  try {
    const [slot, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
    ]);
    const d0 = await getTokenDecimals(token0);
    const d1 = await getTokenDecimals(token1);
    const price = sqrtPriceX96ToPrice(slot.sqrtPriceX96, d0, d1);
    return { tick: Number(slot.tick), price, sqrtPriceX96: slot.sqrtPriceX96.toString(), token0, token1, decimals0: d0, decimals1: d1 };
  } catch (error) {
    log("price_error", `Pool price: ${error.message}`);
    return null;
  }
}

export async function getMyPositions({ force = false } = {}) {
  const nfpm = new ethers.Contract(PANCAKESWAP.V3_NFPM, NFPM_ABI, getProvider());
  const address = getWalletAddress();
  let rawPositions = [];

  try {
    const balance = await nfpm.balanceOf(address);
    const count = Number(balance);
    log("positions", `Found ${count} NFT position(s)`);

    for (let i = 0; i < count; i++) {
      const tokenId = await nfpm.tokenOfOwnerByIndex(address, i);
      const pos = await nfpm.positions(tokenId);
      rawPositions.push({
        tokenId: Number(tokenId),
        token0: pos.token0,
        token1: pos.token1,
        feeTier: Number(pos.fee),
        tickLower: Number(pos.tickLower),
        tickUpper: Number(pos.tickUpper),
        liquidity: pos.liquidity.toString(),
        feesOwed0: pos.tokensOwed0,
        feesOwed1: pos.tokensOwed1,
      });
    }
  } catch (error) {
    log("positions_error", `Get positions: ${error.message}`);
  }

  const openAddresses = rawPositions.map(p => p.tokenId.toString());
  syncOpenPositions(openAddresses);

  const positions = await Promise.all(rawPositions.map(async (p) => {
    const poolAddr = await getPoolFromTokens(p.token0, p.token1, p.feeTier);
    const symbol0 = await getTokenSymbol(p.token0);
    const symbol1 = await getTokenSymbol(p.token1);
    const d0 = await getTokenDecimals(p.token0);
    const d1 = await getTokenDecimals(p.token1);
    const lowerPrice = tickToPrice(p.tickLower, d0, d1);
    const upperPrice = tickToPrice(p.tickUpper, d0, d1);

    let currentPrice = null;
    let inRange = true;
    let currentTick = null;
    if (poolAddr) {
      const state = await getPoolCurrentPrice(poolAddr);
      if (state) {
        currentPrice = state.price;
        currentTick = state.tick;
        inRange = state.tick >= p.tickLower && state.tick <= p.tickUpper;
      }
    }

    const d0f = Number(await getTokenDecimals(p.token0)) || 18;
    const d1f = Number(await getTokenDecimals(p.token1)) || 18;
    const fees0 = Number(ethers.formatUnits(p.feesOwed0, d0f));
    const fees1 = Number(ethers.formatUnits(p.feesOwed1, d1f));

    return {
      position: p.tokenId.toString(),
      pool: poolAddr || `${symbol0}/${symbol1}`,
      pair: `${symbol0}/${symbol1}`,
      token0: p.token0,
      token1: p.token1,
      token0Symbol: symbol0,
      token1Symbol: symbol1,
      feeTier: p.feeTier,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      minPrice: lowerPrice,
      maxPrice: upperPrice,
      currentPrice,
      currentTick,
      in_range: inRange,
      liquidity: p.liquidity,
      unclaimedFee0: fees0,
      unclaimedFee1: fees1,
    };
  }));

  return { total_positions: positions.length, positions };
}

// ─── Compute Price Range ───────────────────────────────────────
export function computePriceRange(poolDetail, rangePct = 10) {
  const lowerPct = 1 - rangePct / 100;
  const upperPct = 1 + rangePct / 100;
  const currentPrice = sqrtPriceX96ToPrice(
    poolDetail.sqrtPriceX96,
    poolDetail.token0.decimals || 18,
    poolDetail.token1.decimals || 18,
  );
  return {
    currentPrice,
    lowerPrice: currentPrice * lowerPct,
    upperPrice: currentPrice * upperPct,
    rangePct,
  };
}

// ─── Deploy Position ───────────────────────────────────────────
export async function deployPosition({
  pool_address,
  token0,
  token1,
  fee_tier,
  price_lower,
  price_upper,
  amount0,
  amount1,
  recipient = null,
  deadline_minutes = 30,
}) {
  if (process.env.DRY_RUN === "true") {
    return {
      dry_run: true,
      would_deploy: { pool_address, token0, token1, fee_tier, price_lower, price_upper, amount0, amount1 },
    };
  }

  const signer = getSigner();
  const nfpm = new ethers.Contract(PANCAKESWAP.V3_NFPM, NFPM_ABI, signer);
  const provider = getProvider();
  const addr = getWalletAddress();

  const poolDetail = await getPoolDetail(pool_address);
  if (!poolDetail) throw new Error("Pool not found");

  const token0Detail = await getTokenInfo(poolDetail.token0);
  const token1Detail = await getTokenInfo(poolDetail.token1);
  if (!token0Detail || !token1Detail) throw new Error("Token info not found");

  const tickSpacing = 10; // 0.05% default
  const tickLower = Math.floor(Math.log(price_lower) / Math.log(1.0001) / tickSpacing) * tickSpacing;
  const tickUpper = Math.ceil(Math.log(price_upper) / Math.log(1.0001) / tickSpacing) * tickSpacing;

  const amount0Wei = ethers.parseUnits(String(amount0 || 0), token0Detail.decimals);
  const amount1Wei = ethers.parseUnits(String(amount1 || 0), token1Detail.decimals);

  // Approve tokens
  if (amount0Wei > 0n) {
    const t0 = new ethers.Contract(poolDetail.token0, ERC20_ABI, signer);
    await t0.approve(PANCAKESWAP.V3_NFPM, amount0Wei);
  }
  if (amount1Wei > 0n) {
    const t1 = new ethers.Contract(poolDetail.token1, ERC20_ABI, signer);
    await t1.approve(PANCAKESWAP.V3_NFPM, amount1Wei);
  }

  const deadline = Math.floor(Date.now() / 1000) + deadline_minutes * 60;
  const recipientAddr = normalizeAddress(recipient || addr);

  const mintParams = {
    token0: poolDetail.token0,
    token1: poolDetail.token1,
    fee: fee_tier || poolDetail.feeTier,
    tickLower,
    tickUpper,
    amount0Desired: amount0Wei,
    amount1Desired: amount1Wei,
    amount0Min: 0,
    amount1Min: 0,
    recipient: recipientAddr,
    deadline,
  };

  log("deploy", `Minting position: token0=${amount0 || 0} ${token0Detail.symbol}, token1=${amount1 || 0} ${token1Detail.symbol}`);
  log("deploy", `Range: tick ${tickLower} → ${tickUpper} (${price_lower} → ${price_upper})`);

  try {
    const tx = await nfpm.mint(mintParams, { gasLimit: 500000 });
    const receipt = await tx.wait();

    const mintLog = receipt.logs.find(l => {
      try {
        const parsed = nfpm.interface.parseLog({ topics: l.topics, data: l.data });
        return parsed?.name === "IncreaseLiquidity";
      } catch { return false; }
    });

    let tokenId = null;
    const transferLog = receipt.logs.find(l => {
      try {
        const parsed = nfpm.interface.parseLog({ topics: l.topics, data: l.data });
        return parsed?.name === "Transfer";
      } catch { return false; }
    });
    if (transferLog) {
      const parsed = nfpm.interface.parseLog({ topics: transferLog.topics, data: transferLog.data });
      tokenId = parsed?.args?.tokenId?.toString();
    }

    trackPosition({
      position: tokenId,
      pool: pool_address,
      pool_name: `${token0Detail.symbol}/${token1Detail.symbol}`,
      strategy: config.strategy.strategy,
      tickRange: { lower: tickLower, upper: tickUpper },
      priceRange: { lower: price_lower, upper: price_upper },
      amount0,
      amount1,
      token0Symbol: token0Detail.symbol,
      token1Symbol: token1Detail.symbol,
    });

    appendDecision({
      type: "deploy",
      pool: pool_address,
      position: tokenId,
      summary: `Deployed ${amount0 || 0} ${token0Detail.symbol} + ${amount1 || 0} ${token1Detail.symbol}`,
      reason: `Range ${price_lower}→${price_upper}`,
    });

    return {
      success: true,
      position: tokenId,
      pool: pool_address,
      tokenId,
      txHash: receipt.hash,
    };
  } catch (error) {
    log("deploy_error", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Close Position ────────────────────────────────────────────
export async function closePosition({ position_address, collect_fees = true }) {
  if (process.env.DRY_RUN === "true") {
    return { dry_run: true, would_close: { position_address } };
  }

  const signer = getSigner();
  const nfpm = new ethers.Contract(PANCAKESWAP.V3_NFPM, NFPM_ABI, signer);
  const tokenId = position_address;

  try {
    const pos = await nfpm.positions(tokenId);

    if (collect_fees) {
      const collectParams = {
        tokenId,
        recipient: getWalletAddress(),
        amount0Max: pos.tokensOwed0,
        amount1Max: pos.tokensOwed1,
      };
      const collectTx = await nfpm.collect(collectParams, { gasLimit: 300000 });
      await collectTx.wait();
      log("close", `Fees collected for position ${tokenId}`);
    }

    const decreaseParams = {
      tokenId,
      liquidity: pos.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(Date.now() / 1000) + 1800,
    };
    const decreaseTx = await nfpm.decreaseLiquidity(decreaseParams, { gasLimit: 500000 });
    await decreaseTx.wait();
    log("close", `Liquidity decreased for position ${tokenId}`);

    const collectAllParams = {
      tokenId,
      recipient: getWalletAddress(),
      amount0Max: ethers.MaxUint256,
      amount1Max: ethers.MaxUint256,
    };
    const collectAllTx = await nfpm.collect(collectAllParams, { gasLimit: 300000 });
    await collectAllTx.wait();
    log("close", `All tokens collected for position ${tokenId}`);

    const burnTx = await nfpm.burn(tokenId, { gasLimit: 200000 });
    await burnTx.wait();
    log("close", `Position ${tokenId} burned`);

    recordClose(tokenId, { closed_at: new Date().toISOString() });
    recordPerformance({
      position: tokenId,
      pool: pos.token0.slice(0, 8),
      close_reason: "manual",
      pnl: 0,
    });

    appendDecision({
      type: "close",
      position: tokenId,
      summary: "Position closed and liquidity withdrawn",
      reason: "Manual close",
    });

    return { success: true, position: tokenId };
  } catch (error) {
    log("close_error", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Claim Fees ────────────────────────────────────────────────
export async function claimFees({ position_address }) {
  if (process.env.DRY_RUN === "true") {
    return { dry_run: true, would_claim: { position_address } };
  }

  const signer = getSigner();
  const nfpm = new ethers.Contract(PANCAKESWAP.V3_NFPM, NFPM_ABI, signer);

  try {
    const pos = await nfpm.positions(position_address);
    const collectParams = {
      tokenId: position_address,
      recipient: getWalletAddress(),
      amount0Max: pos.tokensOwed0,
      amount1Max: pos.tokensOwed1,
    };
    const tx = await nfpm.collect(collectParams, { gasLimit: 300000 });
    const receipt = await tx.wait();

    recordClaim(position_address, { amount0: pos.tokensOwed0.toString(), amount1: pos.tokensOwed1.toString(), txHash: receipt.hash });

    return {
      success: true,
      position: position_address,
      amount0: ethers.formatEther(pos.tokensOwed0),
      amount1: ethers.formatEther(pos.tokensOwed1),
      txHash: receipt.hash,
    };
  } catch (error) {
    log("claim_error", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Swap Token ────────────────────────────────────────────────
export async function swapToken({ input_mint, output_mint, amount }) {
  if (process.env.DRY_RUN === "true") {
    return { dry_run: true, would_swap: { input_mint, output_mint, amount } };
  }

  const signer = getSigner();
  const router = new ethers.Contract(PANCAKESWAP.V3_ROUTER, ROUTER_ABI, signer);
  const isNativeIn = isSameAddress(input_mint, PANCAKESWAP.WBNB);
  const isNativeOut = isSameAddress(output_mint, PANCAKESWAP.WBNB);

  if (!isNativeIn) {
    const token = new ethers.Contract(normalizeAddress(input_mint), ERC20_ABI, signer);
    const amountIn = ethers.parseUnits(String(amount), 18);
    await token.approve(PANCAKESWAP.V3_ROUTER, amountIn);
  }

  const amountInWei = ethers.parseUnits(String(amount), 18);
  const params = {
    tokenIn: normalizeAddress(isNativeIn ? "0x0000000000000000000000000000000000000000" : input_mint),
    tokenOut: normalizeAddress(output_mint),
    fee: 500,
    recipient: getWalletAddress(),
    deadline: Math.floor(Date.now() / 1000) + 1800,
    amountIn: amountInWei,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  };

  try {
    const tx = await router.exactInputSingle(params, {
      value: isNativeIn ? amountInWei : 0,
      gasLimit: 300000,
    });
    const receipt = await tx.wait();
    return { success: true, txHash: receipt.hash, amount_in: amount, amount_out: "see tx" };
  } catch (error) {
    log("swap_error", error.message);
    return { success: false, error: error.message };
  }
}

// ─── Search Pools (via subgraph) ───────────────────────────────
export async function searchPools({ query, limit = 10 }) {
  const q = query.toLowerCase();
  const queryStr = `{
    pools(first: ${limit}, where: { or: [{token0_: {symbol_contains_nocase: "${q}"}}, {token1_: {symbol_contains_nocase: "${q}"}}, {id_contains_nocase: "${q}"}] }) {
      id token0 { id symbol } token1 { id symbol } feeTier totalValueLockedUSD volumeUSD txCount
    }
  }`;

  try {
    const res = await fetch(PANCAKESWAP.V3_SUBGRAPH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: queryStr }),
    });
    if (!res.ok) throw new Error(`Search pools: ${res.status}`);
    const data = await res.json();
    return data.data?.pools?.map(p => ({
      address: normalizeAddress(p.id),
      pair: `${p.token0.symbol}/${p.token1.symbol}`,
      feeTier: Number(p.feeTier),
      tvl: Number(p.totalValueLockedUSD),
      volume: Number(p.volumeUSD),
      txCount: Number(p.txCount),
    })) || [];
  } catch (error) {
    log("search_error", error.message);
    return [];
  }
}

export async function studyTopLPers() {
  return { warning: "Top LPer study not available for PancakeSwap v3 on-chain" };
}
