import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

const NotificationContext = createContext(null);

const TYPE_STYLES = {
  info: { bg: 'var(--bq-info-soft-bg, #eff6ff)', bar: 'var(--bq-info, #2563eb)', fg: 'var(--bq-text, #1f2433)' },
  success: { bg: 'var(--bq-accent-soft-bg, #e0e7ff)', bar: 'var(--bq-success, #16a34a)', fg: 'var(--bq-text, #1f2433)' },
  warning: { bg: 'var(--bq-warning-soft-bg, #fff7ed)', bar: 'var(--bq-warning, #ea580c)', fg: 'var(--bq-text, #1f2433)' },
  error: { bg: 'var(--bq-warning-soft-bg, #fdecec)', bar: 'var(--bq-danger, #dc2626)', fg: 'var(--bq-text, #1f2433)' },
};

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message, type = 'info', duration = 4000) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((list) => [...list, { id, message, type }]);
    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const confirm = useCallback(
    (message, options = {}) =>
      new Promise((resolve) => {
        setConfirmState({
          message,
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          danger: !!options.danger,
          resolve,
        });
      }),
    [],
  );

  const closeConfirm = useCallback((result) => {
    setConfirmState((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  };
  const modal = {
    width: '100%',
    maxWidth: '440px',
    background: 'var(--surface, #ffffff)',
    color: 'var(--ink-900, #1f2433)',
    border: '1px solid var(--line, #e6e8f1)',
    borderRadius: '12px',
    boxShadow: '0 18px 48px rgba(38,40,70,0.25)',
    padding: '24px',
  };
  const btn = {
    padding: '10px 18px',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid transparent',
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 10001,
          maxWidth: '360px',
        }}
      >
        {toasts.map((t) => {
          const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
          return (
            <div
              key={t.id}
              role="status"
              onClick={() => dismiss(t.id)}
              style={{
                background: s.bg,
                color: s.fg,
                borderLeft: `4px solid ${s.bar}`,
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                lineHeight: 1.4,
                boxShadow: '0 6px 18px rgba(38,40,70,0.18)',
                cursor: 'pointer',
                whiteSpace: 'pre-line',
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div style={overlay} onClick={() => closeConfirm(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 20px', fontSize: '15px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {confirmState.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                style={{
                  ...btn,
                  background: 'var(--surface, #fff)',
                  color: 'var(--ink-700, #353c4e)',
                  borderColor: 'var(--line-strong, #ccd1e2)',
                }}
                onClick={() => closeConfirm(false)}
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                style={{
                  ...btn,
                  background: confirmState.danger ? 'var(--danger, #dc2626)' : 'var(--green-700, #4338ca)',
                  color: '#ffffff',
                }}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within a <NotificationProvider>');
  }
  return ctx;
}
