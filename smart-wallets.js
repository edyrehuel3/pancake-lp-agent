import fs from "fs";
import { repoPath } from "./repo-root.js";

const PATH = repoPath("smart-wallets.json");

function load() {
  try {
    if (!fs.existsSync(PATH)) return [];
    return JSON.parse(fs.readFileSync(PATH, "utf8"));
  } catch { return []; }
}

function save(data) { fs.writeFileSync(PATH, JSON.stringify(data, null, 2)); }

export function addSmartWallet({ name, address, category, type }) {
  const wallets = load();
  wallets.push({ name, address, category: category || "alpha", type: type || "lp", added_at: new Date().toISOString() });
  save(wallets);
  return { added: true };
}

export function removeSmartWallet({ address }) {
  const wallets = load().filter(w => w.address !== address);
  save(wallets);
  return { removed: true };
}

export function listSmartWallets() { return load(); }

export function checkSmartWalletsOnPool({ pool_address }) {
  return { wallets: [], in_pool: false };
}
