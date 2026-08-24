const { ApiError } = require('./errorHandler');

// In-memory fixed-window limiter. No Redis, no extra dependency: this exists
// to stop a judge hammering the demo from burning the Gemini free-tier quota,
// not to survive a real botnet. State resets when the process restarts.
function rateLimiter({ windowMs = 60_000, max = 60, key } = {}) {
  const hits = new Map();

  // Drop expired buckets periodically so a long-running process does not grow
  // a Map entry per IP forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(k);
    }
  }, windowMs).unref();

  const middleware = (req, res, next) => {
    const id = key ? key(req) : req.user?.id || req.ip;
    const now = Date.now();
    let bucket = hits.get(id);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(id, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return next(
        new ApiError(429, `Too many requests, try again in ${retryAfter}s`)
      );
    }
    next();
  };

  middleware.stop = () => clearInterval(sweep);
  return middleware;
}

module.exports = rateLimiter;
