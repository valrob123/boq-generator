import React from 'react';

/**
 * Card container used to group form sections and tables.
 *
 * Props:
 *   title    optional header label (omitted when empty)
 *   height   CSS height for the card (default "auto")
 *   children card body
 */
export default function ContentCard({ title, height = 'auto', children }) {
  return (
    <section className="content-card" style={{ height }}>
      {title ? (
        <header className="content-card__header">
          <h2 className="content-card__title">{title}</h2>
        </header>
      ) : null}
      <div className="content-card__body">{children}</div>
    </section>
  );
}
