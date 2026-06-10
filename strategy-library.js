import fs from "fs";
import { repoPath } from "./repo-root.js";

const PATH = repoPath("strategies.json");

function load() {
  try {
    if (!fs.existsSync(PATH)) return [];
    return JSON.parse(fs.readFileSync(PATH, "utf8"));
  } catch { return []; }
}

function save(data) { fs.writeFileSync(PATH, JSON.stringify(data, null, 2)); }

export function addStrategy(strategy) {
  const strategies = load();
  strategies.push({ ...strategy, created_at: new Date().toISOString() });
  save(strategies);
  return { saved: true, id: strategy.id };
}

export function listStrategies() {
  return load().map(s => ({ id: s.id, name: s.name, author: s.author }));
}

export function getStrategy(id) {
  return load().find(s => s.id === id) || { error: "Strategy not found" };
}

export function setActiveStrategy(id) {
  return { active: id };
}

export function removeStrategy(id) {
  const strategies = load().filter(s => s.id !== id);
  save(strategies);
  return { removed: true };
}
