import fs from "fs";
import { repoPath } from "./repo-root.js";

const LOG_PATH = repoPath("decision-log.json");

function load() {
  try {
    if (!fs.existsSync(LOG_PATH)) return [];
    const raw = fs.readFileSync(LOG_PATH, "utf8").trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(decisions) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(decisions, null, 2));
}

export function appendDecision(entry) {
  const decisions = load();
  decisions.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (decisions.length > 200) decisions.splice(0, decisions.length - 200);
  save(decisions);
}

export function getRecentDecisions(limit = 6) {
  const decisions = load();
  return decisions.slice(-limit).reverse();
}
