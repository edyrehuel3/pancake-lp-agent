import fs from "fs";
import { repoPath } from "./repo-root.js";

const PATH = repoPath("token-blacklist.json");

function load() {
  try {
    if (!fs.existsSync(PATH)) return [];
    return JSON.parse(fs.readFileSync(PATH, "utf8"));
  } catch { return []; }
}

function save(data) { fs.writeFileSync(PATH, JSON.stringify(data, null, 2)); }

export function isBlacklisted(mint) {
  if (!mint) return false;
  const list = load();
  return list.some(t => t.mint?.toLowerCase() === mint.toLowerCase());
}

export function addToBlacklist({ mint, symbol, reason }) {
  const list = load();
  list.push({ mint, symbol, reason, at: new Date().toISOString() });
  save(list);
  return { added: true };
}

export function removeFromBlacklist({ mint }) {
  const list = load().filter(t => t.mint?.toLowerCase() !== mint?.toLowerCase());
  save(list);
  return { removed: true };
}

export function listBlacklist() { return load(); }
