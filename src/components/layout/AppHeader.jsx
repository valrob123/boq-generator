import React, { useEffect, useRef, useState } from 'react';
import {
  Menu, Save, FilePlus2, Plus, FolderOpen, Download,
  FileSpreadsheet, FileText, ChevronDown,
} from 'lucide-react';

/**
 * Sticky workspace header: editable document name, BOQ number badge, status
 * pill, and the primary document actions (New / Open / Save / Export).
 */
export default function AppHeader({
  title,
  placeholder,
  onTitleChange,
  badge,
  status,
  onToggleNav,
  onSave,
  onSaveNew,
  onNew,
  onOpen,
  savedCount = 0,
  onExportExcel,
  onExportPdf,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setExportOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const statusClass = status
    ? `app-header__status app-header__status--${status.toLowerCase().replace(/\s+/g, '-')}`
    : '';

  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header__menu"
        onClick={onToggleNav}
        aria-label="Toggle navigation"
      >
        <Menu size={20} />
      </button>

      <div className="app-header__doc">
        <input
          className="app-header__title"
          type="text"
          value={title || ''}
          placeholder={placeholder}
          onChange={(e) => onTitleChange?.(e.target.value)}
          aria-label="Document name"
        />
        <div className="app-header__meta">
          {badge && <span className="app-header__badge">{badge}</span>}
          {status && <span className={statusClass}>{status}</span>}
        </div>
      </div>

      <div className="app-header__actions">
        <button type="button" className="btn btn-secondary" onClick={onNew}>
          <Plus size={16} />
          <span className="btn-label">New</span>
        </button>

        <button type="button" className="btn btn-secondary" onClick={onOpen}>
          <FolderOpen size={16} />
          <span className="btn-label">Open</span>
          {savedCount > 0 && <span className="btn-count">{savedCount}</span>}
        </button>

        <button type="button" className="btn btn-secondary" onClick={onSaveNew}>
          <FilePlus2 size={16} />
          <span className="btn-label">Save as New</span>
        </button>

        <div className="app-header__export" ref={ref}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setExportOpen((v) => !v)}
            aria-expanded={exportOpen}
          >
            <Download size={16} />
            <span className="btn-label">Export</span>
            <ChevronDown size={14} />
          </button>
          {exportOpen && (
            <div className="menu-pop" role="menu">
              <button
                className="menu-pop__item"
                onClick={() => {
                  setExportOpen(false);
                  onExportExcel?.();
                }}
              >
                <FileSpreadsheet size={16} /> Excel workbook
              </button>
              <button
                className="menu-pop__item"
                onClick={() => {
                  setExportOpen(false);
                  onExportPdf?.();
                }}
              >
                <FileText size={16} /> PDF document
              </button>
            </div>
          )}
        </div>

        <button type="button" className="btn btn-success" onClick={onSave}>
          <Save size={16} />
          <span className="btn-label">Save</span>
        </button>
      </div>
    </header>
  );
}
