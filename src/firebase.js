// src/firebase.js
// Firebase is OPTIONAL. The app is offline-first: if no VITE_FIREBASE_* env
// vars are supplied, Firebase is never initialized and every cloud feature is
// hidden — the app keeps working entirely on local storage.
//
// NOTE ON "SECRECY": Vite inlines VITE_* variables into the client bundle at
// build time, so the Firebase web config is NOT a secret (it's public by
// design). Real protection comes from Firebase Auth + Firestore Security Rules
// (see README). The .env file is about configuration, not secrecy.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Considered "configured" only when the essential keys are present.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    // Never let a bad config crash the desktop app — fall back to offline mode.
    console.error('[BOQ Builder] Firebase init failed; running offline-only.', err);
    app = null;
    auth = null;
    db = null;
  }
} else if (import.meta.env.DEV) {
  console.info(
    '[BOQ Builder] Firebase not configured — offline-only mode. ' +
      'Add a .env file (see .env.example) to enable cloud sign-in & backup.',
  );
}

export { app, auth, db };
