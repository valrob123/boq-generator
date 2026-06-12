import React from 'react';

/**
 * Interactive SVG donut of cost distribution by category (no chart library).
 *
 * Props:
 *   segments     [{ id, code, name, value, pct, color }]
 *   total        number shown in the centre when nothing is hovered
 *   activeId     currently highlighted segment id (controlled)
 *   onHover(id)  hover/focus a segment (null on leave)
 *   onSelect(id) click a segment
 *   formatValue  (n) => string
 */
export default function CostDonut({ segments, total, activeId, onHover, onSelect, formatValue }) {
  const size = 230;
  const stroke = 26;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2 - 6;

  const active = segments.find((s) => s.id === activeId) || null;
  const centerPct = active ? `${active.pct.toFixed(1)}%` : '100%';
  const centerValue = active ? formatValue(active.value) : formatValue(total);
  const centerLabel = active ? `${active.id} · ${active.name}` : 'Direct cost (subtotal)';

  let acc = 0;

  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut__svg" role="img" aria-label="Cost distribution by category">
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          {segments.map((s) => {
            const start = acc;
            acc += s.pct;
            const isActive = activeId === s.id;
            const dim = activeId != null && !isActive;
            return (
              <circle
                key={s.id}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={isActive ? stroke + 7 : stroke}
                strokeDasharray={`${Math.max(s.pct - 0.4, 0)} ${100 - Math.max(s.pct - 0.4, 0)}`}
                strokeDashoffset={-start}
                pathLength={100}
                className="donut__seg"
                style={{ opacity: dim ? 0.3 : 1 }}
                onMouseEnter={() => onHover?.(s.id)}
                onMouseLeave={() => onHover?.(null)}
                onClick={() => onSelect?.(s.id)}
              />
            );
          })}
        </g>
      </svg>
      <div className="donut__center">
        <span className="donut__center-pct">{centerPct}</span>
        <span className="donut__center-value">{centerValue}</span>
        <span className="donut__center-label">{centerLabel}</span>
      </div>
    </div>
  );
}
