/**
 * pages/anggaran.page.js
 * ─────────────────────────────────────────────────────────────
 * Tab Anggaran — user bisa tambah/edit/hapus anggaran sendiri.
 * ─────────────────────────────────────────────────────────────
 */

import { budgetState, upsertBudget, removeBudget, getSpentByCategory } from "../services/budget.service.js";
import { state } from "../services/transaction.service.js";
import { rp, rpFull, gc, parseAmt, formatAmtInput, showToast } from "../ui.helpers.js";

// Semua kategori yang bisa dianggarkan
export const ALL_CATS = [
  "Makanan","Transportasi","Belanja","Kesehatan",
  "Hiburan","Pendidikan","Sedekah","Lainnya",
];

export function renderBudget() {
  const spent  = getSpentByCategory();
  const budgets = budgetState.budgets;

  // ── Header ─────────────────────────────────────────────────
  const grid = document.getElementById("budgetGrid");
  if (!grid) return;

  if (budgets.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 24px;color:var(--ink3);">
        <div style="font-size:40px;margin-bottom:16px;">📋</div>
        <div style="font-size:15px;font-weight:700;color:var(--ink2);margin-bottom:8px;">Belum ada anggaran</div>
        <div style="font-size:13px;margin-bottom:20px;">Tambah anggaran untuk mulai tracking pengeluaranmu</div>
        <button class="btn btn-ink" onclick="openBudgetModal()" style="margin:0 auto;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Anggaran
        </button>
      </div>`;
    return;
  }

  grid.innerHTML = budgets.map(b => {
    const s    = spent[b.cat] || 0;
    const pct  = Math.min(Math.round(s / b.limit * 100), 100);
    const warn = pct >= 85;
    const m    = gc(b.cat);
    const pillStyle = warn
      ? "background:var(--rose-bg);color:var(--rose)"
      : pct >= 60 ? "background:var(--amber-bg);color:var(--amber)"
      : "background:var(--teal-bg);color:var(--teal)";
    const barColor = warn ? "var(--rose)" : pct >= 60 ? "var(--amber)" : m.c;
    const sisa = b.limit - s;

    return `<div class="budget-item">
      <div class="budget-top">
        <div class="budget-ico" style="background:${m.bg};color:${m.c}">${m.ico}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <div class="budget-pct-pill" style="${pillStyle}">${pct}%</div>
          <button onclick="openBudgetModal('${b.id}')" title="Edit"
            style="background:none;border:none;cursor:pointer;color:var(--ink3);padding:2px;display:flex;align-items:center;border-radius:6px;transition:background .13s;"
            onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="confirmDeleteBudget('${b.id}','${b.cat}')" title="Hapus"
            style="background:none;border:none;cursor:pointer;color:var(--ink3);padding:2px;display:flex;align-items:center;border-radius:6px;transition:all .13s;"
            onmouseover="this.style.background='var(--rose-bg)';this.style.color='var(--rose)'" onmouseout="this.style.background='none';this.style.color='var(--ink3)'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="budget-cat">${b.cat}</div>
      <div class="budget-spent" style="color:${warn ? "var(--rose)" : "var(--ink)"}">${rpFull(s)}</div>
      <div class="budget-limit">dari ${rpFull(b.limit)}</div>
      ${warn ? `<div style="font-size:11px;color:var(--rose);font-weight:600;margin-top:4px;">⚠️ Mendekati batas! Sisa ${rpFull(sisa)}</div>` : `<div style="font-size:11px;color:var(--ink3);margin-top:4px;">Sisa ${rpFull(sisa)}</div>`}
      <div class="budget-track"><div class="budget-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>`;
  }).join("");
}

// ── Modal tambah/edit anggaran ─────────────────────────────────
let _editingBudgetId = null;

export function openBudgetModal(id = null) {
  _editingBudgetId = id;
  const modal = document.getElementById("budgetModalWrap");
  const title = document.getElementById("budgetModalTitle");
  const catSel = document.getElementById("bCat");
  const limitIn = document.getElementById("bLimit");
  const limitPrev = document.getElementById("bLimitPreview");

  if (limitPrev) limitPrev.textContent = "";

  // Isi opsi kategori — exclude yang sudah ada anggaran (kecuali yang sedang diedit)
  const usedCats = budgetState.budgets
    .filter(b => b.id !== id)
    .map(b => b.cat);

  catSel.innerHTML = ALL_CATS
    .filter(c => !usedCats.includes(c))
    .map(c => `<option value="${c}">${c}</option>`)
    .join("");

  if (id) {
    // Mode edit
    const budget = budgetState.budgets.find(b => b.id === id);
    if (!budget) return;
    title.textContent = "Edit Anggaran";
    // Pastikan kategori ini ada di options
    if (!catSel.querySelector(`option[value="${budget.cat}"]`)) {
      catSel.innerHTML = `<option value="${budget.cat}">${budget.cat}</option>` + catSel.innerHTML;
    }
    catSel.value  = budget.cat;
    limitIn.value = budget.limit.toLocaleString("id-ID");
    if (limitPrev) limitPrev.textContent = "= " + rpFull(budget.limit);
  } else {
    // Mode tambah
    title.textContent = "Tambah Anggaran";
    catSel.value  = catSel.options[0]?.value || "";
    limitIn.value = "";
  }

  modal.classList.add("open");
  setTimeout(() => limitIn.focus(), 100);
}

export function closeBudgetModal() {
  document.getElementById("budgetModalWrap").classList.remove("open");
  _editingBudgetId = null;
}

export async function submitBudget() {
  const cat   = document.getElementById("bCat").value;
  const limit = parseAmt(document.getElementById("bLimit").value);

  if (!cat)   { showToast("Pilih kategori!", "err"); return; }
  if (!limit || limit <= 0) {
    document.getElementById("bLimit").style.borderColor = "var(--rose)";
    setTimeout(() => document.getElementById("bLimit").style.borderColor = "", 1600);
    showToast("Masukkan nominal anggaran!", "err"); return;
  }

  const uid = state.uid;
  await upsertBudget(uid, { id: _editingBudgetId, cat, limit });
  closeBudgetModal();
  renderBudget();
  showToast(`Anggaran ${cat} berhasil ${_editingBudgetId ? "diupdate" : "ditambahkan"}!`);
}

export async function confirmDeleteBudget(id, cat) {
  if (!confirm(`Hapus anggaran "${cat}"?`)) return;
  await removeBudget(state.uid, id);
  renderBudget();
  showToast(`Anggaran ${cat} dihapus`);
}

export function updateBLimitPreview() {
  const amt = parseAmt(document.getElementById("bLimit").value);
  const el  = document.getElementById("bLimitPreview");
  if (!el) return;
  el.textContent = amt > 0 ? "= " + rpFull(amt) : "";
}