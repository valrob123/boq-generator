// src/services/cloudStore.js
// Thin Firestore data layer for backing up BOQ documents per signed-in user.
// Documents live at: users/{uid}/boqs/{docId}
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// Build a stable, filesystem-safe document id from a BOQ number / name.
function safeId(value) {
  const base = String(value || '').trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return base || `boq_${Date.now()}`;
}

export async function backupBOQ(uid, { number, name, snapshot }) {
  if (!db) throw new Error('Cloud storage is not configured.');
  const id = safeId(number || name);
  await setDoc(doc(db, 'users', uid, 'boqs', id), {
    name: name || number || 'Untitled BOQ',
    number: number || '',
    snapshot,
    updatedAt: Date.now(),
  });
  return id;
}

export async function listBOQs(uid) {
  if (!db) throw new Error('Cloud storage is not configured.');
  const q = query(collection(db, 'users', uid, 'boqs'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function removeBOQ(uid, id) {
  if (!db) throw new Error('Cloud storage is not configured.');
  await deleteDoc(doc(db, 'users', uid, 'boqs', id));
}
