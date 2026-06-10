import fs from "fs";
import { repoPath } from "./repo-root.js";

const MEMORY_PATH = repoPath("pool-memory.json");

function load() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return { pools: {} };
    return JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
  } catch { return { pools: {} }; }
}

function save(data) { fs.writeFileSync(MEMORY_PATH, JSON.stringify(data, null, 2)); }

export function getPoolMemory(poolAddress) {
  const data = load();
  return data.pools[poolAddress] || { deploys: [], notes: [] };
}

export function addPoolNote({ pool_address, note }) {
  const data = load();
  if (!data.pools[pool_address]) data.pools[pool_address] = { deploys: [], notes: [] };
  data.pools[pool_address].notes.push({ text: note, at: new Date().toISOString() });
  save(data);
}

export function recordPoolDeploy(poolAddress, deployData) {
  const data = load();
  if (!data.pools[poolAddress]) data.pools[poolAddress] = { deploys: [], notes: [] };
  data.pools[poolAddress].deploys.push({ ...deployData, at: new Date().toISOString() });
  save(data);
}

export function isPoolOnCooldown(poolAddress) { return false; }
export function isBaseMintOnCooldown(mint) { return false; }
