// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase';

const AuthContext = createContext(null);

// Make sure every signed-in user has a profile document holding their plan
// and subscription status.
async function ensureProfile(u) {
  if (!db || !u) return;
  try {
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: u.email || '',
        plan: 'free',                 // 'free' | 'pro'
        subscriptionStatus: 'inactive', // 'inactive' | 'active' | 'trialing' | 'canceled'
        createdAt: Date.now(),
      });
    }
  } catch {
    /* offline or rules issue — handled by the live listener below */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Track the signed-in user.
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Live-subscribe to the user's profile (plan / subscription status).
  useEffect(() => {
    if (!user || !db) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }
    setProfileLoading(true);
    ensureProfile(user);
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => { setProfile(snap.exists() ? snap.data() : null); setProfileLoading(false); },
      () => { setProfile(null); setProfileLoading(false); },
    );
    return unsub;
  }, [user]);

  const signOutUser = async () => {
    if (isFirebaseConfigured && auth) {
      try { await signOut(auth); } catch { /* ignore */ }
    }
    setUser(null);
    setProfile(null);
  };

  // Admins (comma-separated emails in VITE_ADMIN_EMAILS) always get full access
  // and skip the promo wall, regardless of their stored plan.
  const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = Boolean(
    user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()),
  );

  const plan = isAdmin ? 'admin' : (profile && profile.plan) || 'free';
  const isPro = isAdmin || plan === 'pro';

  const value = {
    user,
    loading,
    profile,
    profileLoading,
    plan,
    isPro,
    isAdmin,
    configured: isFirebaseConfigured,
    isAuthed: Boolean(user),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null, loading: false, profile: null, profileLoading: false, plan: 'free',
      isPro: false, isAdmin: false, configured: false, isAuthed: false,
    };
  }
  return ctx;
}
