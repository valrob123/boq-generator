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
      return undefined;
    }
    ensureProfile(user);
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => setProfile(snap.exists() ? snap.data() : null),
      () => setProfile(null),
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

  const plan = (profile && profile.plan) || 'free';
  const isPro = plan === 'pro';

  const value = {
    user,
    loading,
    profile,
    plan,
    isPro,
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
      user: null, loading: false, profile: null, plan: 'free', isPro: false,
      configured: false, isAuthed: false,
    };
  }
  return ctx;
}
