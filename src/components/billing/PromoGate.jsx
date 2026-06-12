// src/components/billing/PromoGate.jsx
// Shown after sign-in when the user is not yet on Pro. The full app stays
// hidden until they avail the promo (their plan becomes 'pro').
import React, { useState } from 'react';
import { Crown, Check, LogOut, Sparkles, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { activateWithCode, setPlan, PRO_ACTIVATION_CODE } from '../../services/billing';

const PRO_FEATURES = [
  'Full access to the BOQ workspace & dashboard',
  'DPWH / DOH-compliant Excel & PDF export',
  'Cloud backup & multi-device sync',
  'Restore any BOQ from the cloud',
];

export default function PromoGate() {
  const { user, signOutUser } = useAuth();
  const { notify } = useNotification();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const isDev = import.meta.env.DEV;

  const redeem = async () => {
    if (!code.trim()) { notify('Enter your promo / activation code.', 'warning'); return; }
    setBusy(true);
    try {
      await activateWithCode(user.uid, code);
      notify('Promo availed — welcome to Pro!', 'success');
      // The live profile listener flips the gate to the app automatically.
    } catch (err) {
      notify(err.message || 'Activation failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const devSetPro = async () => {
    setBusy(true);
    try {
      await setPlan(user.uid, 'pro');
      notify('Pro enabled (test).', 'success');
    } catch (err) {
      notify(err.message || 'Could not update plan.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="promo">
      <header className="promo__top">
        <div className="promo__brand">
          <span className="promo__mark"><Crown size={20} /></span>
          BOQ Builder <strong>Pro</strong>
        </div>
        <div className="promo__user">
          <span className="promo__email">{user?.email}</span>
          <button type="button" className="btn btn-secondary" onClick={signOutUser}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <main className="promo__main">
        <div className="promo__card">
          <span className="promo__tag"><Sparkles size={14} /> Limited promo</span>
          <h1 className="promo__title">Avail the promo to unlock BOQ Builder</h1>
          <p className="promo__sub">
            Your account is ready, {user?.email?.split('@')[0]}. Activate your
            subscription to open the full app.
          </p>

          <ul className="promo__features">
            {PRO_FEATURES.map((f) => <li key={f}><Check size={16} /> {f}</li>)}
          </ul>

          {PRO_ACTIVATION_CODE ? (
            <div className="promo__redeem">
              <input
                type="text"
                value={code}
                placeholder="Enter promo / activation code"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }}
              />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={redeem}>
                {busy ? <Loader2 size={16} className="spin" /> : <Crown size={16} />} Avail promo
              </button>
            </div>
          ) : (
            <p className="promo__note">
              Online checkout isn’t enabled in this build. An admin can activate your
              account by setting <code>plan = "pro"</code> on your{' '}
              <code>users/&#123;uid&#125;</code> record in Firestore, or you can connect a
              payment provider (see README). Access updates automatically once activated.
            </p>
          )}

          {isDev && (
            <div className="promo__dev">
              <span>Developer test:</span>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={devSetPro}>
                Set Pro
              </button>
            </div>
          )}

          <p className="promo__foot">
            <ShieldCheck size={14} /> Your access updates automatically the moment your subscription is active.
          </p>
        </div>
      </main>
    </div>
  );
}
