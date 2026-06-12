import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  listWorks,
  getWork,
  saveWork,
  subscribe,
} from '../utils/storage';

/**
 * useSavedWork wires an editor (BOQ.jsx) to the persistent saved-work store.
 *
 * Config:
 *   module        unique store key (see MODULES)
 *   getSnapshot   () => serialisable editor state
 *   applySnapshot (snapshot) => void   restores editor state
 *   deriveMeta    (snapshot) => { name, projectName, client, status, progress }
 *
 * Returns:
 *   save(overrideMeta?, opts?)  persist current snapshot. opts.forceNew creates
 *                               a brand-new record. Returns the saved record.
 *   startNew()                  clears the editor for a fresh document.
 *   savedList                   live, newest-first list of saved works.
 */
export function useSavedWork({ module, getSnapshot, applySnapshot, deriveMeta }) {
  const app = useApp();
  const [savedList, setSavedList] = useState(() => listWorks(module));
  const currentIdRef = useRef(null);

  // Keep the latest callbacks without forcing save/startNew identities to change.
  const getSnapshotRef = useRef(getSnapshot);
  const applySnapshotRef = useRef(applySnapshot);
  const deriveMetaRef = useRef(deriveMeta);
  getSnapshotRef.current = getSnapshot;
  applySnapshotRef.current = applySnapshot;
  deriveMetaRef.current = deriveMeta;

  // Keep savedList in sync with the store across the whole app.
  useEffect(() => {
    const refresh = () => setSavedList(listWorks(module));
    refresh();
    return subscribe(refresh);
  }, [module]);

  // Drain a pending "open" request (queued by AppContext.requestLoad) on mount.
  useEffect(() => {
    const pending = app.consumePendingLoad(module);
    if (pending && pending.id) {
      const record = getWork(module, pending.id);
      if (record) {
        currentIdRef.current = record.id;
        applySnapshotRef.current(record.snapshot);
      }
    }
    // Intentionally mount-only: re-runs happen via editorKey remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(
    (overrideMeta = {}, opts = {}) => {
      const snapshot = getSnapshotRef.current();
      const meta = { ...deriveMetaRef.current(snapshot), ...overrideMeta };
      const id = opts.forceNew ? null : currentIdRef.current;
      const record = saveWork(module, { id, meta, snapshot });
      currentIdRef.current = record.id;
      return record;
    },
    [module],
  );

  const startNew = useCallback(() => {
    currentIdRef.current = null;
    app.requestNewDocument();
  }, [app]);

  return { save, startNew, savedList };
}
