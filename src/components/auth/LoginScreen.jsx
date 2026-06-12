// src/components/auth/LoginScreen.jsx
import React, { useState } from 'react';
import {
  FileBarChart2, LogIn, UserPlus, ShieldCheck, Cloud, WifiOff, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const { configured, signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const friendly = (err) => {
    const code = (err && err.code) || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
      return 'Incorrect email or password.';
    if (code.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
    if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
    if (code.includes('invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('network')) return 'Network error — check your connection or continue offline.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Try again later.';
    return (err && err.message) || 'Something went wrong.';
  };

  const submit = async () => {
    setError('');
    setResetMsg('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      // On success the auth listener flips the gate to the app automatically.
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setError('');
    setResetMsg('');
    if (!email.trim()) {
      setError('Enter your email above first, then choose “Forgot password”.');
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetMsg(`Password reset link sent to ${email.trim()}.`);
    } catch (err) {
      setError(friendly(err));
    }
  };

  return (
    <div className="login">
      <aside className="login__hero">
        <div className="login__brand">
          <span className="login__mark"><FileBarChart2 size={26} /></span>
          <div>
            <strong>BOQ Builder</strong>
            <span>Bill of Quantities · DPWH / DOH</span>
          </div>
        </div>

        <div className="login__pitch">
          <h1>Build, price and export professional Bills of Quantities.</h1>
          <p>Sign in to back up your BOQs to the cloud and reach them from any machine. Your work stays available offline once you’re signed in.</p>
          <ul className="login__features">
            <li><ShieldCheck size={18} /> DPWH / DOH-compliant Excel &amp; PDF exports</li>
            <li><Cloud size={18} /> Optional cloud backup &amp; sync per account</li>
            <li><WifiOff size={18} /> Works fully offline on-site</li>
          </ul>
        </div>

        <p className="login__foot">© {new Date().getFullYear()} BOQ Builder</p>
      </aside>

      <main className="login__panel">
        <div className="login__card">
          <h2 className="login__title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="login__sub">
            {configured
              ? (mode === 'signin' ? 'Sign in to continue.' : 'Start backing up your work to the cloud.')
              : 'Cloud accounts aren’t configured yet — you can continue offline.'}
          </p>

          <fieldset className="login__form" disabled={!configured || busy}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password" value={password}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              />
            </div>

            {error && <p className="auth-error">{error}</p>}
            {resetMsg && <p className="auth-success">{resetMsg}</p>}

            <button type="button" className="btn btn-primary login__submit" onClick={submit} disabled={!configured || busy}>
              {busy ? <Loader2 size={16} className="spin" /> : mode === 'signin' ? <LogIn size={16} /> : <UserPlus size={16} />}
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </fieldset>

          {configured && mode === 'signin' && (
            <button type="button" className="login__forgot" onClick={doReset}>Forgot password?</button>
          )}

          {configured ? (
            <p className="login__switch">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          ) : (
            <p className="login__hint" style={{ marginTop: '18px' }}>
              Cloud accounts aren’t configured. Add your Firebase keys to
              <code> .env</code> and rebuild to enable sign-in.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
