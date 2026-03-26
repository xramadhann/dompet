/**
 * js/services/budget.service.js
 * ─────────────────────────────────────────────────────────────
 * State & business logic untuk anggaran (budgets).
 * ─────────────────────────────────────────────────────────────
 */

import { loadBudgets, saveBudget, deleteBudget } from "./firebase.service.js";
import { state } from "./transaction.service.js";

// ── State ──────────────────────────────────────────────────────
export const budgetState = {
  budgets: [], // [{ id, cat, limit, createdAt }]
};

/** Muat budgets dari Firebase */
export async function initBudgets(uid) {
  try {
    budgetState.budgets = await loadBudgets(uid);
  } catch {
    // fallback localStorage
    try {
      const saved = localStorage.getItem(`dompet_budgets_${uid}`);
      budgetState.budgets = saved ? JSON.parse(saved) : [];
    } catch { budgetState.budgets = []; }
  }
}

function _syncCache(uid) {
  try {
    localStorage.setItem(`dompet_budgets_${uid}`, JSON.stringify(budgetState.budgets));
  } catch {}
}

/** Tambah atau update anggaran */
export async function upsertBudget(uid, { id, cat, limit }) {
  const existing = budgetState.budgets.findIndex(b => b.id === id);
  const budget = {
    id:        id || `b_${Date.now()}`,
    cat,
    limit:     Number(limit),
    createdAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    budgetState.budgets[existing] = budget;
  } else {
    budgetState.budgets.push(budget);
  }

  _syncCache(uid);
  await saveBudget(uid, budget);
  return budget;
}

/** Hapus anggaran */
export async function removeBudget(uid, id) {
  budgetState.budgets = budgetState.budgets.filter(b => b.id !== id);
  _syncCache(uid);
  await deleteBudget(uid, id);
}

/** Hitung pengeluaran bulan ini per kategori */
export function getSpentByCategory() {
  const now = new Date();
  const spent = {};
  state.transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.type === "out" &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth();
    })
    .forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + t.amount; });
  return spent;
}

/** Hitung sedekah bulan ini */
export function getSedekahBulanIni() {
  const now = new Date();
  return state.transactions
    .filter(t => {
      const d = new Date(t.date);
      return t.cat === "Sedekah" &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth();
    })
    .reduce((s, t) => s + t.amount, 0);
}