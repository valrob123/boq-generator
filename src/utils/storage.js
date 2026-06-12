/**
 * Saved-work store.
 *
 * Persists "saved works" (full editor snapshots + lightweight metadata) per
 * module in localStorage, and provides a tiny pub/sub so any open hook can keep
 * its list in sync after a save/delete from anywhere in the app.
 *
 * Record shape:
 *   {
 *     id, name, projectName, client, status, progress,
 *     snapshot,            // opaque editor state restored via applySnapshot
 *     createdAt, updatedAt // epoch ms
 *   }
 */

export const MODULES = Object.freeze({
  BOQ: 'boq',
  COST_ESTIMATE: 'cost-estimate',
  S_CURVE: 's-curve',
});

const storageKey = (module) => `boqdesktop:saved:${module}`;

const listeners = new Set();

function emit() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a misbehaving listener must not break the others */
    }
  });
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function readAll(module) {
  try {
    const raw = window.localStorage.getItem(storageKey(module));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(module, records) {
  try {
    window.localStorage.setItem(storageKey(module), JSON.stringify(records));
  } catch {
    /* quota / unavailable — keep going so the editor stays usable */
  }
  emit();
}

const makeId = () =>
  `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function listWorks(module) {
  return readAll(module)
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getWork(module, id) {
  return readAll(module).find((w) => w.id === id) || null;
}

/**
 * Create or update a saved work.
 * Pass `id: null` (or omit) to create a new record; pass an existing id to update.
 * Returns the persisted record (with its final id).
 */
export function saveWork(module, { id = null, meta = {}, snapshot = null } = {}) {
  const records = readAll(module);
  const now = Date.now();

  if (id != null) {
    const index = records.findIndex((w) => w.id === id);
    if (index >= 0) {
      records[index] = { ...records[index], ...meta, snapshot, updatedAt: now };
      writeAll(module, records);
      return records[index];
    }
  }

  const record = {
    id: makeId(),
    ...meta,
    snapshot,
    createdAt: now,
    updatedAt: now,
  };
  records.push(record);
  writeAll(module, records);
  return record;
}

export function deleteWork(module, id) {
  writeAll(
    module,
    readAll(module).filter((w) => w.id !== id),
  );
}
