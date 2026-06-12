import React, { useEffect } from 'react';
import { X, Clock, Trash2 } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const STATUS_TONE = {
  Completed: { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
  Draft: { bg: '#fff7ed', color: '#b45309', border: '#fed7aa' },
};

function formatWhen(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Modal dialog for opening a previously saved BOQ.
 *
 * Props:
 *   open, onClose
 *   savedList   array of saved records (newest first)
 *   onOpen(id)  open a record
 *   onDelete(id) delete a record
 */
export default function OpenDialog({ open, onClose, savedList = [], onOpen, onDelete }) {
  const { confirm } = useNotification();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Open saved BOQ"
      >
        <div className="modal__head">
          <h3>Saved BOQs</h3>
          <button type="button" className="btn-action" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {savedList.length === 0 ? (
          <p className="modal__empty">
            No saved BOQs yet. Use <strong>Save</strong> to create one.
          </p>
        ) : (
          <ul className="open-list">
            {savedList.map((w) => {
              const tone = STATUS_TONE[w.status] || STATUS_TONE.Draft;
              return (
                <li key={w.id} className="open-list__item">
                  <button
                    type="button"
                    className="open-list__main"
                    onClick={() => onOpen?.(w.id)}
                    title="Open this BOQ"
                  >
                    <span className="open-list__name">{w.name || 'Untitled BOQ'}</span>
                    {w.projectName && (
                      <span className="open-list__sub">{w.projectName}</span>
                    )}
                    <span className="open-list__meta">
                      <span
                        className="open-list__badge"
                        style={{ background: tone.bg, color: tone.color, borderColor: tone.border }}
                      >
                        {w.status || 'Draft'}
                      </span>
                      <span className="open-list__pct">{Number(w.progress || 0)}%</span>
                      <span className="open-list__when">
                        <Clock size={12} />
                        {formatWhen(w.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-action open-list__del"
                    title="Delete"
                    onClick={async () => {
                      if (
                        await confirm(
                          'Delete this saved BOQ permanently? This cannot be undone.',
                          { confirmText: 'Delete', danger: true },
                        )
                      ) {
                        onDelete?.(w.id);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
