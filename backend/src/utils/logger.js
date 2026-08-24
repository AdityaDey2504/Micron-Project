// Deliberately tiny. Structured enough to grep, small enough to ignore.
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = levels[process.env.LOG_LEVEL] ?? levels.info;

function log(level, message, meta) {
  if (levels[level] > threshold) return;
  const stamp = new Date().toISOString();
  const tail = meta === undefined ? '' : ` ${safeStringify(meta)}`;
  const line = `${stamp} [${level.toUpperCase()}] ${message}${tail}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function safeStringify(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

module.exports = {
  error: (m, meta) => log('error', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  info: (m, meta) => log('info', m, meta),
  debug: (m, meta) => log('debug', m, meta),
};
