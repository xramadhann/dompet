/**
 * services/transaction.service.js
 * ─────────────────────────────────────────────────────────────
 * Business logic untuk transaksi: CRUD, kalkulasi saldo,
 * rollover bulanan, export CSV. Tidak menyentuh DOM.
 * ─────────────────────────────────────────────────────────────
 */

import ENV from "../env.js";
import { checkAndNotifyThreshold, notifyTransactionSaved } from "./notification.service.js";
import {
  saveTransaction,
  deleteTransaction,
  clearAllTransactions,
  saveLastYM,
  saveSettings,
  saveSaldoAwal  as fbSaveSaldoAwal,
  saveInvestasiAwal as fbSaveInvestasiAwal,
} from "./firebase.service.js";
import { makeUID } from "./auth.service.js";

// ── State (dikelola module ini, di-consume oleh pages) ─────────
export const state = {
  uid:           null,
  username:      null,
  transactions:  [],   // array, newest-first
  saldoAwal:     0,
  investasiAwal: 0,
  lastYM:        null,
};

/** Set state awal setelah login & loadUserData */
export function initState(uid, username, data) {
  state.uid           = uid;
  state.username      = username;
  state.transactions  = data.transactions  ?? [];
  state.saldoAwal     = data.saldoAwal     ?? 0;
  state.investasiAwal = data.investasiAwal ?? 0;
  state.lastYM        = data.lastYM        ?? null;
}

/** Reset state saat logout */
export function resetState() {
  state.uid = state.username = state.lastYM = null;
  state.transactions = [];
  state.saldoAwal = state.investasiAwal = 0;
}

// ── Kalkulasi ──────────────────────────────────────────────────

export const incSum = txArr =>
  txArr.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0);

export const expSum = txArr =>
  txArr.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0);

/** Transaksi dalam bulan & tahun tertentu */
export const byMonth = (y, m) =>
  state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });

/** Sisa saldo akumulatif (semua waktu) */
export const getSisaSaldo = () =>
  state.saldoAwal + incSum(state.transactions) - expSum(state.transactions);

/** Total investasi (modal awal + semua tx Investasi) */
export const getTotalInvestasi = () => {
  const delta = state.transactions
    .filter(t => t.cat === "Investasi")
    .reduce((s, t) => t.type === "out" ? s + t.amount : s - t.amount, 0);
  return state.investasiAwal + delta;
};

// ── CRUD Transaksi ─────────────────────────────────────────────

/**
 * Buat & simpan transaksi baru.
 * @returns {{ success: boolean, error?: string, tx?: object }}
 */
export async function addTransaction({ name, cat, amount, date, type, note = "" }) {
  // Validasi
  if (!name?.trim())        return { success: false, error: "Isi nama transaksi." };
  if (!amount || amount <= 0) return { success: false, error: "Jumlah harus lebih dari 0." };
  if (amount > ENV.app.maxTransaction)
    return { success: false, error: "Nominal terlalu besar, cek kembali." };
  if (!date)                return { success: false, error: "Pilih tanggal transaksi." };

  // Cek defisit (hanya untuk pengeluaran)
  const defisit = type === "out" ? checkDefisit(amount) : null;
  // defisit tidak memblokir — UI yang meminta konfirmasi, lalu panggil forceAddTransaction

  const tx = {
    id:     Date.now(),
    name:   name.trim(),
    cat,
    amount,
    date,
    type,
    note:   note.trim(),
  };

  state.transactions.unshift(tx);
  _syncLocalCache();

  try {
    await saveTransaction(state.uid, tx);
  } catch (e) {
    console.warn("Firebase saveTransaction gagal (offline?):", e);
  }

  // Notif konfirmasi transaksi tersimpan
  notifyTransactionSaved(tx);

  // Cek threshold notif (hanya untuk pengeluaran, sekali per hari per threshold)
  if (type === "out") {
    const now = new Date();
    const monthTx = state.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const totalInc = incSum(monthTx);
    const totalExp = expSum(monthTx);
    const pct = totalInc > 0 ? Math.round(totalExp / totalInc * 100) : 0;
    console.log('[Threshold] inc:', totalInc, 'exp:', totalExp, 'pct:', pct + '%');
    await checkAndNotifyThreshold(state.uid, totalInc, totalExp);
  }

  return { success: true, tx, defisit };
}

/**
 * Paksa simpan transaksi meski menyebabkan defisit.
 * (Dipanggil setelah user konfirmasi di dialog defisit)
 */
export async function forceAddTransaction(payload) {
  return addTransaction(payload); // sama, tapi tanpa cek defisit di luar
}

/** Hapus transaksi berdasarkan id */
export async function removeTransaction(txId) {
  state.transactions = state.transactions.filter(t => t.id !== txId);
  _syncLocalCache();
  try {
    await deleteTransaction(state.uid, txId);
  } catch (e) {
    console.warn("Firebase deleteTransaction gagal:", e);
  }
}

/** Hapus semua transaksi user */
export async function clearAll() {
  state.transactions = [];
  _syncLocalCache();
  try {
    await clearAllTransactions(state.uid);
  } catch (e) {
    console.warn("Firebase clearAllTransactions gagal:", e);
  }
}

// ── Saldo Awal ─────────────────────────────────────────────────
export async function updateSaldoAwal(value) {
  state.saldoAwal = value;
  _syncLocalCache();
  await fbSaveSaldoAwal(state.uid, value);
}

// ── Investasi Awal ─────────────────────────────────────────────
export async function updateInvestasiAwal(value) {
  state.investasiAwal = value;
  _syncLocalCache();
  await fbSaveInvestasiAwal(state.uid, value);
}

// ── Tarik Dana Investasi ───────────────────────────────────────
/**
 * Catat penarikan investasi sebagai pemasukan.
 * @returns {{ success: boolean, error?: string }}
 */
export async function tarikInvestasi({ amount, date, note = "" }) {
  const total = getTotalInvestasi();
  if (!amount || amount <= 0)
    return { success: false, error: "Masukkan jumlah yang ingin ditarik." };
  if (amount > total)
    return { success: false, error: "Jumlah melebihi total investasi." };

  return addTransaction({
    name:  "Tarik Dana Investasi",
    cat:   "Investasi",
    amount,
    date,
    type:  "in",
    note:  note || "Penarikan dari investasi",
  });
}

// ── Auto-Rollover ──────────────────────────────────────────────
/**
 * Jika bulan berubah, sisa saldo bulan lalu masuk sebagai
 * pemasukan di awal bulan ini.
 * @returns {boolean} true jika rollover dilakukan
 */
export async function autoRollover() {
  if (!ENV.features.autoRollover) return false;

  const now     = new Date();
  const thisYM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { lastYM } = state;

  if (!lastYM) {
    state.lastYM = thisYM;
    _syncLocalCache();
    await saveLastYM(state.uid, thisYM).catch(console.warn);
    return false;
  }
  if (lastYM === thisYM) return false;

  // Hitung sisa saldo semua tx sebelum bulan ini
  const txsBeforeThisMonth = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() < now.getFullYear() ||
      (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth());
  });
  const sisaSebelumnya = state.saldoAwal
    + incSum(txsBeforeThisMonth)
    - expSum(txsBeforeThisMonth);

  if (sisaSebelumnya > 0) {
    const [ly, lm] = lastYM.split("-").map(Number);
    const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const rolloverNote = `Sisa saldo ${MONTHS_ID[(lm - 1 + 11) % 12]} ${ly}`;

    const alreadyAdded = state.transactions.some(
      t => t.note === rolloverNote && t.type === "in"
    );

    if (!alreadyAdded) {
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      await addTransaction({
        name:  "Rollover Sisa Saldo",
        cat:   "Lainnya",
        amount: sisaSebelumnya,
        date:   firstOfMonth,
        type:   "in",
        note:   rolloverNote,
      });
    }
  }

  state.lastYM = thisYM;
  _syncLocalCache();
  await saveLastYM(state.uid, thisYM).catch(console.warn);
  return sisaSebelumnya > 0;
}

// ── Cek Defisit ────────────────────────────────────────────────
/**
 * Hitung apakah transaksi pengeluaran akan menyebabkan defisit.
 * @returns {null | { sisaSaldo, defisitSetelah }} null = tidak defisit
 */
export function checkDefisit(amount) {
  if (!ENV.features.deficitAlert) return null;
  const sisaSaldo   = getSisaSaldo();
  const setelah     = sisaSaldo - amount;
  return setelah < 0 ? { sisaSaldo, defisitSetelah: setelah } : null;
}

// ── Export CSV ─────────────────────────────────────────────────
export function exportCSV() {
  if (!ENV.features.exportCsv) return;
  const header = "Tanggal,Nama,Kategori,Tipe,Jumlah,Catatan\n";
  const rows = [...state.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(t =>
      `${t.date},"${t.name}","${t.cat}","${t.type === "in" ? "Pemasukan" : "Pengeluaran"}",`
      + `${t.type === "in" ? t.amount : -t.amount},"${t.note || ""}"`
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `dompet-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Cache lokal (private) ──────────────────────────────────────
function _uk(key) { return `dompet_u_${state.username}_${key}`; }

function _syncLocalCache() {
  try {
    localStorage.setItem(_uk("txs"),           JSON.stringify(state.transactions));
    localStorage.setItem(_uk("saldo_awal"),    String(state.saldoAwal));
    localStorage.setItem(_uk("investasi_awal"),String(state.investasiAwal));
    if (state.lastYM) localStorage.setItem(_uk("last_ym"), state.lastYM);
  } catch {}
}

/** Muat dari localStorage (fallback offline) */
export function loadFromCache(username) {
  const uk = key => `dompet_u_${username}_${key}`;
  try {
    return {
      transactions:  JSON.parse(localStorage.getItem(uk("txs")) || "[]"),
      saldoAwal:     parseFloat(localStorage.getItem(uk("saldo_awal"))) || 0,
      investasiAwal: parseFloat(localStorage.getItem(uk("investasi_awal"))) || 0,
      lastYM:        localStorage.getItem(uk("last_ym")) || null,
    };
  } catch {
    return { transactions: [], saldoAwal: 0, investasiAwal: 0, lastYM: null };
  }
}