// Firestore data access layer
import { db, auth, ADMIN_EMAIL } from './firebase.js';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// Collections
const colMenu = collection(db, 'menu');
const colOrders = collection(db, 'orders');
const docSettings = doc(db, 'settings', 'globals');

// ---------- SETTINGS ----------
export const ensureDefaultSettings = async () => {
  const snap = await getDoc(docSettings);
  if (!snap.exists()) {
    await setDoc(docSettings, {
      cancelThreshold: 2,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
};

export const getSettings = async () => {
  const snap = await getDoc(docSettings);
  return snap.exists() ? snap.data() : null;
};

export const onSettingsSnapshot = (cb) => onSnapshot(docSettings, (snap) => cb(snap.data()));

export const setCancelThreshold = async (n) => {
  await updateDoc(docSettings, { cancelThreshold: n, updatedAt: serverTimestamp() });
};

// ---------- MENU ----------
export const addMenuItem = async (data) => {
  const payload = {
    name: data.name,
    price: Number(data.price),
    image: data.image || '',
    available: !!data.available,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  return addDoc(colMenu, payload);
};

export const updateMenuItem = async (id, data) => {
  const ref = doc(colMenu, id);
  const payload = { ...data, price: Number(data.price), updatedAt: serverTimestamp() };
  await updateDoc(ref, payload);
};

export const deleteMenuItem = async (id) => {
  const ref = doc(colMenu, id);
  await deleteDoc(ref);
};

export const onMenuItems = (cb, { includeUnavailable = false } = {}) => {
  let qRef = colMenu;
  if (!includeUnavailable) {
    qRef = query(colMenu, where('available', '==', true));
  }
  return onSnapshot(qRef, (snap) => {
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    cb(items.sort((a, b) => a.name.localeCompare(b.name)));
  });
};

export const getAllMenuOnce = async () => {
  const snap = await getDocs(colMenu);
  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  return items;
};

// ---------- ORDERS ----------
export const createOrder = async ({ pid, items, subtotal, status, paymentCode }) => {
  const payload = {
    pid: pid.trim().toUpperCase(),
    items,
    subtotal: Number(subtotal),
    status: status || 'PENDING_PAYMENT',
    paymentCode: paymentCode || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(colOrders, payload);
  return ref;
};

export const updateOrderStatus = async (orderId, status, extra = {}) => {
  const ref = doc(colOrders, orderId);
  await updateDoc(ref, { status, ...extra, updatedAt: serverTimestamp() });
};

export const cancelOrder = async (orderId, pid) => {
  const ref = doc(colOrders, orderId);
  const pidNorm = pid.trim().toUpperCase();
  await updateDoc(ref, { status: 'CANCELLED', updatedAt: serverTimestamp() });
  await addCancellationEvent(pidNorm, orderId);
  return autoBlockIfNeeded(pidNorm);
};

export const getOrdersByPid = async (pid) => {
  const qRef = query(colOrders, where('pid', '==', pid.trim().toUpperCase()), orderBy('createdAt', 'desc'), limit(25));
  const snap = await getDocs(qRef);
  const rows = [];
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  return rows;
};

export const findOrderByPaymentCode = async (code) => {
  const qRef = query(colOrders, where('paymentCode', '==', code.trim().toUpperCase()), limit(1));
  const snap = await getDocs(qRef);
  let found = null;
  snap.forEach(d => { found = { id: d.id, ...d.data() }; });
  return found;
};

export const exportAllData = async () => {
  const [settings, menu, orders] = await Promise.all([
    getSettings(),
    getAllMenuOnce(),
    (async () => {
      const s = await getDocs(query(colOrders, orderBy('createdAt', 'desc')));
      const arr = [];
      s.forEach(d => arr.push({ id: d.id, ...d.data() }));
      return arr;
    })()
  ]);
  return { settings, menu, orders, exportedAt: new Date().toISOString() };
};

// ---------- STUDENTS (block/misuse tracking) ----------
const studentDoc = (pid) => doc(db, 'students', pid.trim().toUpperCase());
const cancellationsCol = (pid) => collection(studentDoc(pid), 'cancellations');

export const getStudent = async (pid) => {
  const snap = await getDoc(studentDoc(pid));
  return snap.exists() ? snap.data() : { blocked: false, blockReason: '' };
};

export const setStudentBlocked = async (pid, blocked, reason = '') => {
  const ref = studentDoc(pid);
  if (blocked) {
    await setDoc(ref, { blocked: true, blockReason: reason, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, { blocked: false, blockReason: '', updatedAt: serverTimestamp() }, { merge: true });
  }
};

export const addCancellationEvent = async (pid, orderId) => {
  await addDoc(cancellationsCol(pid), {
    orderId,
    ts: serverTimestamp(),
  });
};

export const getCancellationCount24h = async (pid) => {
  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const qRef = query(cancellationsCol(pid), where('ts', '>=', since));
  const snap = await getDocs(qRef);
  let n = 0;
  snap.forEach(() => n++);
  return n;
};

export const autoBlockIfNeeded = async (pid) => {
  const [thresholdDoc, count] = await Promise.all([getSettings(), getCancellationCount24h(pid)]);
  const threshold = thresholdDoc?.cancelThreshold ?? 2;
  if (count > threshold) {
    await setStudentBlocked(pid, true, `Auto-block: ${count} cancellations in last 24h (threshold ${threshold})`);
    return { blocked: true, count, threshold };
  }
  return { blocked: false, count, threshold };
};

// ---------- AUTH (Admin) ----------
export const onAuth = (cb) => onAuthStateChanged(auth, cb);

export const loginAdmin = async (password) => {
  // Single-email admin login to satisfy "single password" UI
  return signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
};

export const logoutAdmin = async () => signOut(auth);

export const changeAdminPassword = async (newPassword) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  await updatePassword(auth.currentUser, newPassword);
};

// ---------- RULES NOTE ----------
// Firestore Rules should restrict admin-only mutations to authenticated users with ADMIN_EMAIL.
// See firestore.rules provided in the repo.
