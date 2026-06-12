// src/components/auth/AuthGate.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';
import PromoGate from '../billing/PromoGate';

/**
 * Gate stages:
 *   1. auth still resolving        -> splash
 *   2. not signed in               -> LoginScreen
 *   3. signed in, plan resolving   -> splash
 *   4. signed in but not Pro       -> PromoGate (must avail the promo first)
 *   5. signed in and Pro           -> the app
 */
export default function AuthGate({ children }) {
  const { loading, isAuthed, profileLoading, isPro } = useAuth();

  if (loading) {
    return (
      <div className="auth-splash">
        <Loader2 size={30} className="spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!isAuthed) return <LoginScreen />;

  // Admins and already-Pro users go straight in.
  if (isPro) return children;

  if (profileLoading) {
    return (
      <div className="auth-splash">
        <Loader2 size={30} className="spin" />
        <span>Checking your subscription…</span>
      </div>
    );
  }

  return <PromoGate />;
}
