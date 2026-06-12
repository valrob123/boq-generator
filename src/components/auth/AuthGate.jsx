// src/components/auth/AuthGate.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';

/**
 * Shows a splash while auth state resolves, the login screen when the user is
 * neither signed in nor in offline mode, otherwise the app.
 */
export default function AuthGate({ children }) {
  const { loading, isAuthed } = useAuth();

  if (loading) {
    return (
      <div className="auth-splash">
        <Loader2 size={30} className="spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!isAuthed) return <LoginScreen />;

  return children;
}
