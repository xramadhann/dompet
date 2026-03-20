/**
 * services/auth.service.js
 * ─────────────────────────────────────────────────────────────
 * Semua logika autentikasi: registrasi, login, logout,
 * ganti password. Tidak menyentuh UI — hanya return data/error.
 * ─────────────────────────────────────────────────────────────
 */

import ENV from "../env.js";
import {
  userExists,
  usernameExists,
  getUIDByUsername,
  createUser,
  deleteUser,
  getPasswordHash,
  setPasswordHash,
} from "./firebase.service.js";

// ── UID generator ──────────────────────────────────────────────
/** Buat UID deterministik dari username */
export function makeUID(username) {
  return "u_" + username.toLowerCase().replace(/[^a-z0-9_\-]/g, "_");
}

// ── Hash ───────────────────────────────────────────────────────
/**
 * Hash sederhana DJB2-XOR. Bukan kriptografis — cukup untuk
 * privasi lokal. Untuk production gunakan Firebase Auth.
 */
export function hashPassword(username, password) {
  const str = `${username}:${password}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

// ── Validasi ───────────────────────────────────────────────────
export function validateUsername(username) {
  if (!username || username.length < ENV.threshold.usernameMinLen)
    return `Username minimal ${ENV.threshold.usernameMinLen} karakter.`;
  if (/[^a-zA-Z0-9_\- ]/.test(username))
    return "Username hanya boleh huruf, angka, spasi, _ atau -.";
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < ENV.threshold.passwordMinLen)
    return `Password minimal ${ENV.threshold.passwordMinLen} karakter.`;
  return null;
}

// ── Register ───────────────────────────────────────────────────
/**
 * Daftarkan user baru.
 * @returns {{ success: boolean, error?: string, uid?: string }}
 */
export async function register(username, password, confirmPassword) {
  const uErr = validateUsername(username);
  if (uErr) return { success: false, error: uErr };

  const pErr = validatePassword(password);
  if (pErr) return { success: false, error: pErr };

  if (password !== confirmPassword)
    return { success: false, error: "Konfirmasi password tidak cocok." };

  // Cek ke Firebase apakah username sudah dipakai
  const exists = await usernameExists(username);
  if (exists)
    return { success: false, error: "Username sudah dipakai. Pilih username lain." };

  const uid  = makeUID(username);
  const hash = hashPassword(username, password);

  await createUser(uid, username, hash);

  // Cache lokal
  _cachePassword(username, hash);
  _cacheUserList(username, "add");

  return { success: true, uid };
}

// ── Login ──────────────────────────────────────────────────────
/**
 * Login user.
 * @returns {{ success: boolean, error?: string, uid?: string }}
 */
export async function login(username, password) {
  if (!username) return { success: false, error: "Masukkan username." };
  if (!password) return { success: false, error: "Masukkan password." };

  const uid = makeUID(username);

  // Cek eksistensi user di Firebase
  const exists = await userExists(uid);
  if (!exists)
    return { success: false, error: "Akun tidak ditemukan. Cek username atau buat akun baru." };

  // Verifikasi password dari Firebase (fallback ke cache lokal)
  let storedHash;
  try {
    storedHash = await getPasswordHash(uid);
    if (storedHash) _cachePassword(username, storedHash); // refresh cache
  } catch {
    storedHash = _getCachedPassword(username); // offline fallback
  }

  if (!storedHash)
    return { success: false, error: "Gagal memverifikasi password. Coba lagi." };

  const hash = hashPassword(username, password);
  if (hash !== storedHash)
    return { success: false, error: "Password salah. Coba lagi." };

  return { success: true, uid };
}

// ── Change password ────────────────────────────────────────────
/**
 * Ganti password user yang sedang login.
 * @returns {{ success: boolean, error?: string }}
 */
export async function changePassword(username, oldPassword, newPassword, confirmNew) {
  const uid = makeUID(username);

  // Verifikasi password lama dari cache lokal (sinkron, cepat)
  const cachedHash = _getCachedPassword(username);
  if (!cachedHash || hashPassword(username, oldPassword) !== cachedHash)
    return { success: false, error: "Password lama salah." };

  const pErr = validatePassword(newPassword);
  if (pErr) return { success: false, error: pErr };

  if (newPassword !== confirmNew)
    return { success: false, error: "Konfirmasi password tidak cocok." };

  const newHash = hashPassword(username, newPassword);
  await setPasswordHash(uid, newHash);
  _cachePassword(username, newHash);

  return { success: true };
}

// ── Delete account ─────────────────────────────────────────────
export async function removeUser(username) {
  const uid = makeUID(username);
  await deleteUser(uid, username);
  _cacheUserList(username, "remove");
  try { localStorage.removeItem(`dompet_pw_${username}`); } catch {}
}

// ── Local cache helpers (private) ─────────────────────────────
function _cachePassword(username, hash) {
  try { localStorage.setItem(`dompet_pw_${username}`, hash); } catch {}
}
function _getCachedPassword(username) {
  try { return localStorage.getItem(`dompet_pw_${username}`); } catch { return null; }
}
function _cacheUserList(username, action) {
  try {
    const list = JSON.parse(localStorage.getItem("dompet_users") || "[]");
    if (action === "add" && !list.includes(username)) list.push(username);
    if (action === "remove") {
      const idx = list.indexOf(username);
      if (idx > -1) list.splice(idx, 1);
    }
    localStorage.setItem("dompet_users", JSON.stringify(list));
  } catch {}
}
