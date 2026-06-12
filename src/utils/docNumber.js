/**
 * Document numbering utility.
 *
 * Numbers follow the pattern PREFIX-YEAR-NNN (e.g. BOQ-2026-001) and continue
 * sequentially per prefix, per calendar year. The counter is persisted in
 * localStorage so numbering survives app restarts.
 *
 *   - previewNextNumber(prefix): the next number WITHOUT consuming it.
 *   - commitNextNumber(prefix):  consumes and returns the next number.
 *   - resetCounter(prefix):      resets the year's counter so the next commit is 001.
 */

export const DOC_PREFIXES = Object.freeze({
  BOQ: 'BOQ',
  COST_ESTIMATE: 'CE',
  S_CURVE: 'SC',
});

const counterKey = (prefix, year) => `boqdesktop:counter:${prefix}:${year}`;

const pad = (n) => String(n).padStart(3, '0');

const currentYear = () => new Date().getFullYear();

function lastCommitted(prefix, year) {
  try {
    const raw = window.localStorage.getItem(counterKey(prefix, year));
    const value = parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeCounter(prefix, year, value) {
  try {
    window.localStorage.setItem(counterKey(prefix, year), String(value));
  } catch {
    /* storage unavailable — numbering falls back to in-memory defaults */
  }
}

export function previewNextNumber(prefix) {
  const year = currentYear();
  return `${prefix}-${year}-${pad(lastCommitted(prefix, year) + 1)}`;
}

export function commitNextNumber(prefix) {
  const year = currentYear();
  const next = lastCommitted(prefix, year) + 1;
  writeCounter(prefix, year, next);
  return `${prefix}-${year}-${pad(next)}`;
}

export function resetCounter(prefix) {
  const year = currentYear();
  writeCounter(prefix, year, 0);
  return `${prefix}-${year}-${pad(1)}`;
}
