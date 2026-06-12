import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MODULES, deleteWork as storeDeleteWork } from '../utils/storage';

const AppContext = createContext(null);

/**
 * AppProvider owns the cross-cutting editor state:
 *
 *  - boqItems / setBoqItems: the live line items shared with BOQ.jsx.
 *  - editorKey: bumped to force a clean remount of the editor (open / new).
 *  - pendingLoad: a one-shot "load this saved work on next mount" queue that the
 *    useSavedWork hook drains via consumePendingLoad().
 *
 * Opening or starting a new document clears the live items and bumps editorKey
 * so the editor remounts with a clean slate; useSavedWork then re-hydrates from
 * the saved snapshot (open) or leaves it blank (new).
 */
export function AppProvider({ children }) {
  const [boqItems, setBoqItems] = useState([]);
  const [editorKey, setEditorKey] = useState(0);
  const pendingLoadRef = useRef(null);

  const requestLoad = useCallback((id) => {
    if (!id) return;
    pendingLoadRef.current = { module: MODULES.BOQ, id };
    setBoqItems([]);
    setEditorKey((k) => k + 1);
  }, []);

  const requestNewDocument = useCallback(() => {
    pendingLoadRef.current = null;
    setBoqItems([]);
    setEditorKey((k) => k + 1);
  }, []);

  const consumePendingLoad = useCallback((module) => {
    const pending = pendingLoadRef.current;
    if (pending && pending.module === module) {
      pendingLoadRef.current = null;
      return pending;
    }
    return null;
  }, []);

  const deleteWork = useCallback((id) => {
    if (!id) return;
    storeDeleteWork(MODULES.BOQ, id);
  }, []);

  const value = useMemo(
    () => ({
      boqItems,
      setBoqItems,
      editorKey,
      requestLoad,
      requestNewDocument,
      consumePendingLoad,
      deleteWork,
    }),
    [
      boqItems,
      editorKey,
      requestLoad,
      requestNewDocument,
      consumePendingLoad,
      deleteWork,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an <AppProvider>');
  }
  return ctx;
}
