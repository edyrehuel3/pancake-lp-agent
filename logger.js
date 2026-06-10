const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

export function log(tag, message) {
  if (LOG_LEVELS.info < CURRENT_LEVEL) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}][${tag}] ${message}`);
}

export function logAction(entry) {
  if (LOG_LEVELS.info < CURRENT_LEVEL) return;
  const ts = new Date().toISOString().slice(11, 19);
  const status = entry.success ? "OK" : "FAIL";
  console.log(`[${ts}][action] ${entry.tool} ${status} ${entry.duration_ms}ms`);
  if (entry.error) console.log(`[${ts}][action]   error: ${entry.error}`);
}

export function warn(tag, message) {
  if (LOG_LEVELS.warn < CURRENT_LEVEL) return;
  const ts = new Date().toISOString().slice(11, 19);
  console.warn(`[${ts}][${tag}] ? ${message}`);
}

export function error(tag, message) {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}][${tag}] ? ${message}`);
}
