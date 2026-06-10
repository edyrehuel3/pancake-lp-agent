import fs from "fs";
import { repoPath } from "./repo-root.js";
import { log } from "./logger.js";

const LESSONS_PATH = repoPath("lessons.json");

function load() {
  try {
    if (!fs.existsSync(LESSONS_PATH)) return { lessons: [], performance: [] };
    return JSON.parse(fs.readFileSync(LESSONS_PATH, "utf8"));
  } catch {
    return { lessons: [], performance: [] };
  }
}

function save(data) {
  fs.writeFileSync(LESSONS_PATH, JSON.stringify(data, null, 2));
}

export function addLesson(rule, tags = [], opts = {}) {
  const data = load();
  data.lessons.push({
    id: data.lessons.length + 1,
    rule,
    tags,
    pinned: opts.pinned || false,
    role: opts.role || null,
    created_at: new Date().toISOString(),
  });
  save(data);
  log("lesson", `Saved: ${rule}`);
}

export function recordPerformance(entry) {
  const data = load();
  data.performance.push({
    ...entry,
    closed_at: new Date().toISOString(),
  });
  if (data.performance.length > 500) data.performance.splice(0, data.performance.length - 500);
  save(data);
}

export function getLessons(opts = {}) {
  const data = load();
  let lessons = data.lessons;
  if (opts.role) lessons = lessons.filter(l => !l.role || l.role === opts.role);
  if (opts.pinned !== undefined) lessons = lessons.filter(l => l.pinned === opts.pinned);
  if (opts.tag) lessons = lessons.filter(l => l.tags.includes(opts.tag));
  if (opts.limit) lessons = lessons.slice(0, opts.limit);
  return lessons;
}

export function getPerformanceHistory({ hours = 24, limit = 50 } = {}) {
  const data = load();
  const cutoff = Date.now() - hours * 3600000;
  return data.performance
    .filter(p => new Date(p.closed_at).getTime() > cutoff)
    .slice(-limit)
    .reverse();
}

export function clearAllLessons() {
  const data = load();
  const n = data.lessons.length;
  data.lessons = [];
  save(data);
  return n;
}

export function clearPerformance() {
  const data = load();
  const n = data.performance.length;
  data.performance = [];
  save(data);
  return n;
}

export function removeLessonsByKeyword(keyword) {
  const data = load();
  const before = data.lessons.length;
  data.lessons = data.lessons.filter(l => !l.rule.toLowerCase().includes(keyword.toLowerCase()));
  const removed = before - data.lessons.length;
  save(data);
  return removed;
}

export function pinLesson(id) {
  const data = load();
  const l = data.lessons.find(l => l.id === id);
  if (!l) return { error: `Lesson ${id} not found` };
  l.pinned = true;
  save(data);
  return { pinned: true, id };
}

export function unpinLesson(id) {
  const data = load();
  const l = data.lessons.find(l => l.id === id);
  if (!l) return { error: `Lesson ${id} not found` };
  l.pinned = false;
  save(data);
  return { pinned: false, id };
}

export function listLessons(opts = {}) {
  return getLessons(opts);
}
