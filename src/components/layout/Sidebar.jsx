import React from 'react';
import { Sun, Moon, Image as ImageIcon, FileBarChart2, UserCircle2, Cloud } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Persistent left navigation rail (off-canvas on small screens).
 *
 * Props:
 *   sections        Array<{ id, label, icon }>
 *   active          currently selected section id
 *   onSelect(id)    section selection callback
 *   open            mobile open state
 *   onOpenBranding  open the company branding dialog
 *   onOpenAccount   open the account / cloud-sync dialog
 */
export default function Sidebar({ sections, active, onSelect, open, onOpenBranding, onOpenAccount }) {
  const { isDark, toggleTheme } = useTheme();
  const { companyLogo, companyName } = useSettings();
  const { user, isPro, isAdmin } = useAuth();

  return (
    <aside className={`sidebar${open ? ' is-open' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden="true">
          <FileBarChart2 size={20} />
        </span>
        <div className="sidebar__brand-text">
          <strong>BOQ Builder</strong>
          <span>Desktop Edition</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Sections">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              className={`sidebar__link${active === s.id ? ' is-active' : ''}`}
              onClick={() => onSelect(s.id)}
              aria-current={active === s.id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__company"
          onClick={onOpenBranding}
          title="Company branding"
        >
          {companyLogo ? (
            <img src={companyLogo} alt="Company logo" />
          ) : (
            <span className="sidebar__company-mark">
              <ImageIcon size={16} />
            </span>
          )}
          <span className="sidebar__company-name">
            {companyName || 'Set company branding'}
          </span>
        </button>

        <button
          type="button"
          className="sidebar__company"
          onClick={onOpenAccount}
          title={user ? user.email : 'Account & cloud sync'}
        >
          <span className="sidebar__company-mark">
            {user ? <UserCircle2 size={16} /> : <Cloud size={16} />}
          </span>
          <span className="sidebar__company-name">
            {user ? user.email : 'Account'}
          </span>
          {user && isAdmin ? <span className="plan-badge plan-badge--admin plan-badge--sm">ADMIN</span> : user && isPro ? <span className="plan-badge plan-badge--pro plan-badge--sm">PRO</span> : null}
        </button>

        <button type="button" className="sidebar__theme" onClick={toggleTheme}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  );
}
