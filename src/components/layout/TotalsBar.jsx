import React from 'react';

/**
 * Sticky footer that always shows the live cost figures regardless of the
 * active section.
 *
 * Props:
 *   items  Array<{ label: string, value: string, strong?: boolean }>
 */
export default function TotalsBar({ items = [] }) {
  return (
    <footer className="totals-bar">
      <div className="totals-bar__inner">
        {items.map((it, i) => (
          <div key={i} className={`totals-bar__item${it.strong ? ' is-strong' : ''}`}>
            <span className="totals-bar__label">{it.label}</span>
            <span className="totals-bar__value">{it.value}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
