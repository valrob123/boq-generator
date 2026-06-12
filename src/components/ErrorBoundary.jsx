import React from 'react';

/**
 * Catches render-time errors anywhere in the tree and shows a recovery screen
 * instead of a frozen/blank window. Offers a one-click "clear saved data" reset,
 * which removes the locally stored documents/branding/theme that can become
 * incompatible across versions.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error && error.message ? error.message : String(error) };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetData = () => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const wrap = {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg, #edeff7)',
      color: 'var(--ink-900, #1f2433)',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
    };
    const card = {
      maxWidth: '560px',
      width: '100%',
      background: 'var(--surface, #ffffff)',
      border: '1px solid var(--line, #e6e8f1)',
      borderRadius: '12px',
      padding: '28px',
      boxShadow: '0 18px 48px rgba(38,40,70,0.18)',
    };
    const btn = {
      padding: '10px 16px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '14px',
    };

    return (
      <div style={wrap}>
        <div style={card}>
          <h2 style={{ margin: '0 0 10px', color: 'var(--green-700, #4338ca)' }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
            The app hit an unexpected error and stopped rendering. This is usually caused by
            saved data from an older version. You can reload, or reset the saved data to get a
            clean start. Resetting removes locally stored documents, branding, and theme.
          </p>
          <pre
            style={{
              background: 'var(--surface-2, #f7f8fd)',
              border: '1px solid var(--line, #e6e8f1)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: '0 0 18px',
              maxHeight: '160px',
              overflow: 'auto',
            }}
          >
            {this.state.message}
          </pre>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{ ...btn, background: 'var(--green-700, #4338ca)', color: '#ffffff' }}
              onClick={this.handleReload}
            >
              Reload
            </button>
            <button
              type="button"
              style={{
                ...btn,
                background: 'transparent',
                color: 'var(--danger, #dc2626)',
                border: '1px solid var(--danger, #dc2626)',
              }}
              onClick={this.handleResetData}
            >
              Reset saved data &amp; reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
