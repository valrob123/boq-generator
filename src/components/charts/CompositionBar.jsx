import React, { useState } from 'react';

/**
 * Single stacked bar showing how the Project Total is composed
 * (Direct cost / Markups / VAT) with hover tooltips + a legend.
 *
 * Props:
 *   parts        [{ label, value, color }]
 *   total        number (denominator; usually the project total)
 *   formatValue  (n) => string
 */
export default function CompositionBar({ parts, total, formatValue }) {
  const [hover, setHover] = useState(null);
  const visible = parts.filter((p) => p.value > 0);
  const denom = total > 0 ? total : 1;

  return (
    <div className="composition">
      <div className="composition__bar">
        {visible.map((p, i) => {
          const pct = (p.value / denom) * 100;
          return (
            <div
              key={p.label}
              className={`composition__seg${hover === i ? ' is-hover' : ''}`}
              style={{ width: `${pct}%`, background: p.color }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {pct > 9 && <span className="composition__seg-pct">{pct.toFixed(0)}%</span>}
              {hover === i && (
                <div className="composition__tip">
                  <span>{p.label}</span>
                  <strong>{formatValue(p.value)}</strong>
                  <em>{pct.toFixed(1)}% of total</em>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="composition__legend">
        {visible.map((p) => (
          <span key={p.label} className="composition__chip">
            <i style={{ background: p.color }} />
            {p.label}
            <b>{formatValue(p.value)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
