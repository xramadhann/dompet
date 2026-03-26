/**
 * services/firebase.service.js
 * ─────────────────────────────────────────────────────────────
 * Inisialisasi Firebase dan ekspos semua operasi database.
 * Komponen lain TIDAK boleh import Firebase SDK langsung —
 * semua akses DB harus melalui service ini.
 * ─────────────────────────────────────────────────────────────
 */

import ENV from "../env.js";
import { initializeApp }               from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, set, get,
  push, remove, update, onValue, off,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── Init ───────────────────────────────────────────────────────
export const _app = initializeApp(ENV.firebase);
const _db  = getDatabase(_app);

// ── Path helpers ───────────────────────────────────────────────
export const PATH = {
  user:          uid  => `users/${uid}`,
  profile:       uid  => `users/${uid}/profile`,
  passwordHash:  uid  => `users/${uid}/password_hash`,
  saldoAwal:     uid  => `users/${uid}/saldo_awal`,
  investasiAwal: uid  => `users/${uid}/investasi_awal`,
  lastYM:        uid  => `users/${uid}/last_ym`,
  transactions:  uid  => `users/${uid}/transactions`,
  transaction:  (uid, txId) => `users/${uid}/transactions/${txId}`,
  budgets:       uid  => `users/${uid}/budgets`,
  budget:       (uid, id)   => `users/${uid}/budgets/${id}`,
  usernameToUid: ()   => `username_to_uid`,
  userIndex:     ()   => `user_index`,
};

// ── Low-level helpers ──────────────────────────────────────────
const _ref  = path  => ref(_db, path);
const _get  = path  => get(_ref(path));
const _set  = (path, val)      => set(_ref(path), val);
const _upd  = (path, val)      => update(_ref(path), val);
const _del  = path  => remove(_ref(path));
const _push = (path, val)      => push(_ref(path), val);

// ── User ───────────────────────────────────────────────────────

/** Cek apakah user ada di Firebase (by profile node) */
export async function userExists(uid) {
  const snap = await _get(PATH.profile(uid));
  return snap.exists();
}

/** Cek apakah username ada (via username_to_uid index) */
export async function usernameExists(username) {
  const snap = await _get(`${PATH.usernameToUid()}/${username}`);
  return snap.exists();
}

/** Ambil UID dari username */
export async function getUIDByUsername(username) {
  const snap = await _get(`${PATH.usernameToUid()}/${username}`);
  return snap.exists() ? snap.val() : null;
}

/** Buat user baru di Firebase */
export async function createUser(uid, username, passwordHash) {
  await _set(PATH.user(uid), {
    profile: {
      username,
      created_at: new Date().toISOString(),
    },
    password_hash:  passwordHash,
    saldo_awal:     0,
    investasi_awal: 0,
  });
  // Simpan mapping username → uid
  await _set(`${PATH.usernameToUid()}/${username}`, uid);
}

/** Hapus user beserta semua datanya */
export async function deleteUser(uid, username) {
  await _del(PATH.user(uid));
  await _del(`${PATH.usernameToUid()}/${username}`);
}

// ── Auth / Password ────────────────────────────────────────────

/** Ambil hash password dari Firebase */
export async function getPasswordHash(uid) {
  const snap = await _get(PATH.passwordHash(uid));
  return snap.exists() ? snap.val() : null;
}

/** Simpan hash password baru */
export async function setPasswordHash(uid, hash) {
  await _set(PATH.passwordHash(uid), hash);
}

// ── Load semua data user sekaligus ────────────────────────────

/**
 * Muat seluruh data user dari Firebase dalam 1 request.
 * @returns {{ saldoAwal, investasiAwal, lastYM, transactions }}
 */
export async function loadUserData(uid) {
  const snap = await _get(PATH.user(uid));
  if (!snap.exists()) {
    return { saldoAwal: 0, investasiAwal: 0, lastYM: null, transactions: [] };
  }

  const data = snap.val();

  const transactions = data.transactions
    ? Object.values(data.transactions).sort((a, b) => b.id - a.id)
    : [];

  return {
    saldoAwal:     parseFloat(data.saldo_awal)     || 0,
    investasiAwal: parseFloat(data.investasi_awal) || 0,
    lastYM:        data.last_ym || null,
    transactions,
  };
}

// ── Saldo & Investasi ──────────────────────────────────────────

/** Simpan saldo awal dan investasi awal sekaligus */
export async function saveSettings(uid, saldoAwal, investasiAwal) {
  const updates = {};
  updates[PATH.saldoAwal(uid)]     = saldoAwal;
  updates[PATH.investasiAwal(uid)] = investasiAwal;
  await update(ref(_db), updates);
}

/** Simpan saldo awal saja */
export async function saveSaldoAwal(uid, value) {
  await _set(PATH.saldoAwal(uid), value);
}

/** Simpan investasi awal saja */
export async function saveInvestasiAwal(uid, value) {
  await _set(PATH.investasiAwal(uid), value);
}

// ── Last YM (rollover) ─────────────────────────────────────────

export async function saveLastYM(uid, ym) {
  await _set(PATH.lastYM(uid), ym);
}

// ── Transactions ───────────────────────────────────────────────

/** Simpan satu transaksi ke Firebase */
export async function saveTransaction(uid, tx) {
  await _set(PATH.transaction(uid, String(tx.id)), tx);
}

/** Hapus satu transaksi */
export async function deleteTransaction(uid, txId) {
  await _del(PATH.transaction(uid, String(txId)));
}

/** Hapus semua transaksi user */
export async function clearAllTransactions(uid) {
  await _del(PATH.transactions(uid));
}

// ── Budgets ────────────────────────────────────────────────────

/** Ambil semua anggaran user */
export async function loadBudgets(uid) {
  const snap = await _get(PATH.budgets(uid));
  if (!snap.exists()) return [];
  return Object.values(snap.val());
}

/** Simpan satu anggaran */
export async function saveBudget(uid, budget) {
  await _set(PATH.budget(uid, budget.id), budget);
}

/** Hapus satu anggaran */
export async function deleteBudget(uid, id) {
  await _del(PATH.budget(uid, id));
}

// ── Re-export Firebase refs untuk onValue (realtime listener) ──
export { ref as fbRef, onValue as fbOnValue, off as fbOff, _db as db };