// src/components/billing/UpgradeModal.jsx
import React, { useState } from 'react';
import { X, Check, Crown, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { activateWithCode, setPlan, PRO_ACTIVATION_CODE } from '../../services/billing';

const FREE_FEATURES = [
  'Unlimited local BOQs',
  'DPWH/DOH Excel & PDF export',
  'Interactive dashboard',
];
const PRO_FEATURES = [
  'Everything in Free',
  'Cloud backup & multi-device sync',
  'Restore any BOQ from the cloud',
  'Priority updates',
];

export default function UpgradeModal({ open, onClose }) {
  const { user, isPro } = useAuth();
  const { notify } = useNotification();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;
  const isDev = import.meta.env.DEV;

  const redeem = async () => {
    setBusy(true);
    try {
      await activateWithCode(user.uid, code);
      notify('Pro activated. Thank you!', 'success');
      onClose();
    } catch (err) {
      notify(err.message || 'Activation failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const devToggle = async (plan) => {
    setBusy(true);
    try {
      await setPlan(user.uid, plan);
      notify(plan === 'pro' ? 'Pro enabled (test).' : 'Back to Free (test).', 'success');
      if (plan === 'pro') onClose();
    } catch (err) {
      notify(err.message || 'Could not update plan.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3><Crown size={18} style={{ verticalAlign: '-3px', marginRight: 6, color: 'var(--warning)' }} />Upgrade to Pro</h3>
          <button type="button" className="btn-action" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {isPro ? (
          <p className="modal__note" style={{ marginBottom: 4 }}>
            You're on <strong>Pro</strong> — cloud backup &amp; sync are unlocked. Thanks for your support!
          </p>
        ) : (
          <p className="modal__note">
            Pro unlocks cloud backup so your BOQs sync across machines and can be restored anywhere.
          </p>
        )}

        <div className="plans">
          <div className="plan">
            <div className="plan__name">Free</div>
            <div className="plan__price">₱0</div>
            <ul className="plan__list">
              {FREE_FEATURES.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
            </ul>
          </div>
          <div className="plan plan--pro">
            <div className="plan__badge">Recommended</div>
            <div className="plan__name"><Sparkles size={15} /> Pro</div>
            <div className="plan__price">Subscription</div>
            <ul className="plan__list">
              {PRO_FEATURES.map((f) => <li key={f}><Check size={15} /> {f}</li>)}
            </ul>
          </div>
        </div>

        {!isPro && (
          <div className="upgrade-actions">
            {PRO_ACTIVATION_CODE ? (
              <div className="upgrade-redeem">
                <input
                  type="text" value={code} placeholder="Activation code"
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }}
                />
                <button type="button" className="btn btn-primary" disabled={busy} onClick={redeem}>
                  {busy ? <Loader2 size={16} className="spin" /> : <Crown size={16} />} Activate
                </button>
              </div>
            ) : (
              <p className="upgrade-note">
                Online checkout isn't wired up in this build. To enable Pro for an
                account, set its <code>plan</code> to <code>"pro"</code> in Firestore
                (<code>users/&#123;uid&#125;</code>), or connect a payment provider
                (see README).
              </p>
            )}

            {isDev && (
              <div className="upgrade-dev">
                <span>Developer test:</span>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => devToggle('pro')}>Set Pro</button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => devToggle('free')}>Set Free</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
