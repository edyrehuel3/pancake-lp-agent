import { ethers } from "ethers";
import { getRpcUrl, PANCAKESWAP } from "../config.js";
import { log } from "../logger.js";
import { normalizeAddress, getTokenInfo } from "./pancakeswap.js";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/search";

export async function getTokenInfoTool({ query }) {
  const q = query.toLowerCase().trim();
  let isAddress = ethers.isAddress(q);

  if (isAddress) {
    const addr = normalizeAddress(q);
    const onchain = await getTokenInfo(addr).catch(() => null);
    if (onchain) {
      const dex = await fetchDexScreener(addr).catch(() => null);
      return {
        address: addr,
        name: onchain.name,
        symbol: onchain.symbol,
        decimals: onchain.decimals,
        chain: "bsc",
        priceUsd: dex?.priceUsd || null,
        liquidityUsd: dex?.liquidityUsd || null,
        volume24h: dex?.volume24h || null,
        fdv: dex?.fdv || null,
        txCount24h: dex?.txCount24h || null,
        holders: dex?.holders || null,
        ageDays: dex?.ageDays || null,
      };
    }
  }

  const dex = await fetchDexScreener(q).catch(() => null);
  if (dex) {
    return {
      address: dex.baseToken?.address,
      name: dex.baseToken?.name,
      symbol: dex.baseToken?.symbol,
      chain: "bsc",
      priceUsd: dex.priceUsd,
      liquidityUsd: dex.liquidityUsd,
      volume24h: dex.volume24h,
      fdv: dex.fdv,
      txCount24h: dex.txns?.h24?.buys + dex.txns?.h24?.sells || null,
      holders: dex.holders,
      ageDays: dex.pairCreatedAt ? ((Date.now() - dex.pairCreatedAt) / 86400000).toFixed(1) : null,
    };
  }

  return { error: `Token not found: ${query}` };
}

async function fetchDexScreener(query) {
  const res = await fetch(`${DEXSCREENER_API}?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const data = await res.json();
  const pairs = data.pairs || [];
  const bscPairs = pairs.filter(p => p.chainId === "bsc");
  if (bscPairs.length === 0) return null;
  return bscPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
}

export async function getTokenHolders({ mint, limit = 20 }) {
  return { warning: "Holder data requires BSCScan API key or dedicated provider", holders: [] };
}

export async function getTokenNarrative({ mint }) {
  return { narrative: "Narrative analysis not available for this chain" };
}
