import React from 'react';

/**
 * Interactive legend + inline weight bars, synced with the donut via activeId.
 *
 * Props mirror CostDonut: segments, activeId, onHover, onSelect, formatValue.
 */
export default function CategoryLegend({ segments, activeId, onHover, onSelect, formatValue }) {
  return (
    <ul className="legend">
      {segments.map((s) => (
        <li
          key={s.id}
          className={`legend__row${activeId === s.id ? ' is-active' : ''}`}
          onMouseEnter={() => onHover?.(s.id)}
          onMouseLeave={() => onHover?.(null)}
          onClick={() => onSelect?.(s.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(s.id);
            }
          }}
        >
          <span className="legend__dot" style={{ background: s.color }} />
          <span className="legend__name">
            <strong>{s.id}</strong> {s.name}
          </span>
          <span className="legend__bar" aria-hidden="true">
            <span style={{ width: `${s.pct}%`, background: s.color }} />
          </span>
          <span className="legend__pct">{s.pct.toFixed(1)}%</span>
          <span className="legend__val">{formatValue(s.value)}</span>
        </li>
      ))}
    </ul>
  );
}
