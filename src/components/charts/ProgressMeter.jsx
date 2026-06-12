import React from 'react';
import { Check, Circle } from 'lucide-react';

/**
 * Document completeness meter with a checklist.
 *
 * Props:
 *   percent  0-100
 *   steps    [{ label, done }]
 */
export default function ProgressMeter({ percent, steps = [] }) {
  return (
    <div className="progress-meter">
      <div className="progress-meter__head">
        <span>Document completeness</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress-meter__track">
        <span style={{ width: `${percent}%` }} />
      </div>
      <ul className="progress-meter__steps">
        {steps.map((s) => (
          <li key={s.label} className={s.done ? 'is-done' : ''}>
            {s.done ? <Check size={14} /> : <Circle size={14} />}
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
