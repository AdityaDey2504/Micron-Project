/**
 * Turns a raw day-count into the phrase that reads naturally straight after
 * "bought X ___" - "today" / "yesterday" / "N days ago". A bare day count
 * reads as broken for same-day purchases ("0 days ago"), so 0 and anything
 * unexpected (NaN, negative - clock skew) both collapse to "today" rather
 * than being surfaced raw.
 */
function formatDaysAgo(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}

module.exports = { formatDaysAgo };
