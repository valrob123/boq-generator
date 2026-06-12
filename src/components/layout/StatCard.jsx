import React from 'react';
import { ArrowUpRight } from 'lucide-react';

/**
 * Compact metric tile used on the Overview dashboard.
 *
 * Props:
 *   icon     ReactNode (lucide icon)
 *   label    short caption
 *   value    primary figure (string or number)
 *   tone     'accent' | 'blue' | 'slate' | 'indigo' | 'green' | 'amber'
 *   mono     render the value in a monospace font (for currency)
 *   hint     optional small sub-caption
 *   onClick  when provided, the card becomes an interactive button
 */
export default function StatCard({ icon, label, value, tone = 'slate', mono = false, hint, onClick }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`stat-card stat-card--${tone}${interactive ? ' is-clickable' : ''}`}
      onClick={onClick}
    >
      <span className="stat-card__icon">{icon}</span>
      <div className="stat-card__body">
        <span className="stat-card__label">{label}</span>
        <span className={`stat-card__value${mono ? ' is-mono' : ''}`}>{value}</span>
        {hint && <span className="stat-card__hint">{hint}</span>}
      </div>
      {interactive && <ArrowUpRight className="stat-card__go" size={16} />}
    </Tag>
  );
}
