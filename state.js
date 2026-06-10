import fs from "fs";
import { repoPath } from "./repo-root.js";
import { log } from "./logger.js";

const STATE_PATH = repoPath("state.json");

function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) return { positions: [], notes: {} };
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { positions: [], notes: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

let _state = loadState();

export function getState() {
  return _state;
}

export function trackPosition(data) {
  const existing = _state.positions.findIndex(p => p.position === data.position);
  const entry = {
    ...data,
    deployed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    in_range: true,
    out_of_range_since: null,
  };
  if (existing >= 0) {
    _state.positions[existing] = { ..._state.positions[existing], ...entry };
  } else {
    _state.positions.push(entry);
  }
  saveState(_state);
}

export function getTrackedPosition(positionAddress) {
  return _state.positions.find(p => p.position === positionAddress);
}

export function markOutOfRange(positionAddress) {
  const p = _state.positions.find(p => p.position === positionAddress);
  if (p) {
    p.in_range = false;
    if (!p.out_of_range_since) p.out_of_range_since = new Date().toISOString();
    p.updated_at = new Date().toISOString();
    saveState(_state);
  }
}

export function markInRange(positionAddress) {
  const p = _state.positions.find(p => p.position === positionAddress);
  if (p) {
    p.in_range = true;
    p.out_of_range_since = null;
    p.updated_at = new Date().toISOString();
    saveState(_state);
  }
}

export function minutesOutOfRange(positionAddress) {
  const p = _state.positions.find(p => p.position === positionAddress);
  if (!p || !p.out_of_range_since) return 0;
  return (Date.now() - new Date(p.out_of_range_since).getTime()) / 60000;
}

export function recordClaim(positionAddress, feeData) {
  const p = _state.positions.find(p => p.position === positionAddress);
  if (p) {
    p.claims = p.claims || [];
    p.claims.push({ ...feeData, at: new Date().toISOString() });
    p.updated_at = new Date().toISOString();
    saveState(_state);
  }
}

export function recordClose(positionAddress, closeData) {
  const idx = _state.positions.findIndex(p => p.position === positionAddress);
  if (idx >= 0) {
    _state.positions[idx] = {
      ..._state.positions[idx],
      ...closeData,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveState(_state);
  }
}

export function syncOpenPositions(openAddresses) {
  const openSet = new Set(openAddresses);
  _state.positions = _state.positions.filter(p => openSet.has(p.position));
  saveState(_state);
}

export function setPositionInstruction(positionAddress, instruction) {
  if (!_state.positions.find(p => p.position === positionAddress)) return false;
  if (!instruction) {
    delete _state.notes[positionAddress];
  } else {
    _state.notes[positionAddress] = instruction;
  }
  saveState(_state);
  return true;
}
