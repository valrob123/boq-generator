// src/components/layout/AuthDialog.jsx
import React, { useEffect, useState } from 'react';
import { X, LogIn, UserPlus, LogOut, CloudUpload, CloudDownload, Trash2, RefreshCw, CloudOff, Crown, KeyRound, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { backupBOQ, listBOQs, removeBOQ } from '../../services/cloudStore';
import UpgradeModal from '../billing/UpgradeModal';

/**
 * Account & cloud-sync modal.
 *
 * Props:
 *   open            boolean
 *   onClose         () => void
 *   getSnapshot     () => snapshot object (current BOQ)
 *   onLoad          (snapshot) => void  (applies a snapshot to the editor)
 *   currentName     string
 *   currentNumber   string
 */
export default function AuthDialog({ open, onClose, getSnapshot, onLoad, currentName, currentNumber }) {
  const { user, configured, signIn, signUp, signOutUser, isPro, resetPassword } = useAuth();
  const { notify } = useNotification();

  const [showUpgrade, setShowUpgrade] = useState(false);

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [cloudDocs, setCloudDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const refreshDocs = async () => {
    if (!user) return;
    setLoadingDocs(true);
    try {
      setCloudDocs(await listBOQs(user.uid));
    } catch (err) {
      notify?.(err.message || 'Could not load cloud documents.', 'error');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (open && user && isPro) refreshDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, isPro]);

  const handleReset = async () => {
    if (!user?.email) return;
    try {
      await resetPassword(user.email);
      notify(`Password reset email sent to ${user.email}.`, 'success');
    } catch (err) {
      notify(err.message || 'Could not send the reset email.', 'error');
    }
  };

  if (!open) return null;

  const friendly = (err) => {
    const code = (err && err.code) || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
      return 'Incorrect email or password.';
    if (code.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
    if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
    if (code.includes('invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('network')) return 'Network error — check your connection.';
    return (err && err.message) || 'Something went wrong.';
  };

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      setPassword('');
      notify?.(mode === 'signin' ? 'Signed in.' : 'Account created.', 'success');
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const doBackup = async () => {
    setBusy(true);
    try {
      await backupBOQ(user.uid, {
        number: currentNumber,
        name: currentName,
        snapshot: getSnapshot(),
      });
      notify?.('BOQ backed up to the cloud.', 'success');
      refreshDocs();
    } catch (err) {
      notify?.(err.message || 'Backup failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = (docu) => {
    if (!docu.snapshot) {
      notify?.('This cloud record has no document data.', 'error');
      return;
    }
    onLoad?.(docu.snapshot);
    notify?.(`Loaded "${docu.name}" from the cloud.`, 'success');
    onClose();
  };

  const doDelete = async (id) => {
    setBusy(true);
    try {
      await removeBOQ(user.uid, id);
      setCloudDocs((d) => d.filter((x) => x.id !== id));
      notify?.('Cloud copy deleted.', 'success');
    } catch (err) {
      notify?.(err.message || 'Delete failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const when = (ts) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString(); } catch { return ''; }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{user ? 'Account & Cloud Sync' : 'Sign in'}</h3>
          <button type="button" className="btn-action" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {!configured ? (
          <div className="auth-unconfigured">
            <CloudOff size={34} />
            <h4>Cloud sync isn't configured</h4>
            <p className="modal__note" style={{ marginBottom: 0 }}>
              The app is running in offline-only mode. To enable sign-in and cloud
              backup, copy <code>.env.example</code> to <code>.env</code>, add your
              Firebase web config, then rebuild. See the README for the full setup
              and the Firestore security rules.
            </p>
          </div>
        ) : !user ? (
          <>
            <p className="modal__note">
              {mode === 'signin'
                ? 'Sign in to back up your BOQs and reach them from any machine.'
                : 'Create an account to start backing up your BOQs to the cloud.'}
            </p>
            <div className="auth-form">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={submit} style={{ width: '100%', justifyContent: 'center' }}>
                {mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
              <p className="auth-switch">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
                  {mode === 'signin' ? 'Create one' : 'Sign in'}
                </button>
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="auth-account">
              <div>
                <span className="auth-account__label">Signed in as</span>
                <span className="auth-account__email">
                  {user.email}
                  <span className={`plan-badge plan-badge--${isPro ? 'pro' : 'free'}`}>{isPro ? 'PRO' : 'FREE'}</span>
                </span>
              </div>
              <button type="button" className="btn btn-secondary" onClick={async () => { await signOutUser(); notify?.('Signed out.', 'success'); }}>
                <LogOut size={16} /> Sign out
              </button>
            </div>

            <div className="auth-links">
              <button type="button" className="linkish" onClick={handleReset}>
                <KeyRound size={14} /> Reset password
              </button>
              {!isPro && (
                <button type="button" className="linkish linkish--pro" onClick={() => setShowUpgrade(true)}>
                  <Crown size={14} /> Upgrade to Pro
                </button>
              )}
            </div>

            {isPro ? (
              <>
                <div className="auth-cloud-actions">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={doBackup}>
                    <CloudUpload size={16} /> Back up current BOQ
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={loadingDocs} onClick={refreshDocs}>
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>

                <h4 className="auth-cloud-title">Your cloud BOQs</h4>
                {loadingDocs ? (
                  <p className="modal__empty">Loading…</p>
                ) : cloudDocs.length === 0 ? (
                  <p className="modal__empty">No cloud documents yet. Back up the current BOQ to get started.</p>
                ) : (
                  <ul className="open-list">
                    {cloudDocs.map((d) => (
                      <li key={d.id} className="open-list__item">
                        <button type="button" className="open-list__main" onClick={() => doRestore(d)} title="Load this document">
                          <span className="open-list__name">{d.name}</span>
                          <span className="open-list__sub">{d.number || '—'}</span>
                          <span className="open-list__meta">
                            <span className="open-list__when"><CloudDownload size={12} /> {when(d.updatedAt)}</span>
                          </span>
                        </button>
                        <button type="button" className="btn-action open-list__del" disabled={busy} onClick={() => doDelete(d.id)} title="Delete cloud copy">
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="cloud-locked">
                <span className="cloud-locked__icon"><Lock size={26} /></span>
                <h4>Cloud backup is a Pro feature</h4>
                <p>Upgrade to back up your BOQs to the cloud and restore them on any machine.</p>
                <button type="button" className="btn btn-primary" onClick={() => setShowUpgrade(true)}>
                  <Crown size={16} /> Upgrade to Pro
                </button>
              </div>
            )}

            <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
          </>
        )}
      </div>
    </div>
  );
}
