// src/services/billing.js
// Subscription helpers. The PLAN field on users/{uid} is the single source of
// truth for Pro access across the app.
//
// IMPORTANT: For a *real* paid wall, the plan must be flipped to 'pro' by a
// trusted server (e.g. a Stripe webhook / Cloud Function) — never trusted from
// the client. The client-side activation below is a convenience for desktop
// "license code" style activation and testing; lock the `plan` field to
// server writes in production (see README).
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Optional activation code (set VITE_PRO_ACTIVATION_CODE in .env to enable the
// "redeem code" path). Empty string disables code activation.
export const PRO_ACTIVATION_CODE = import.meta.env.VITE_PRO_ACTIVATION_CODE || '';

export async function setPlan(uid, plan) {
  if (!db) throw new Error('Cloud is not configured.');
  await updateDoc(doc(db, 'users', uid), {
    plan,
    subscriptionStatus: plan === 'pro' ? 'active' : 'inactive',
    updatedAt: Date.now(),
  });
}

export async function activateWithCode(uid, code) {
  if (!PRO_ACTIVATION_CODE) {
    throw new Error('Activation codes are not enabled for this build.');
  }
  if (!code || code.trim() !== PRO_ACTIVATION_CODE) {
    throw new Error('That activation code is not valid.');
  }
  await setPlan(uid, 'pro');
}
