/**
 * pages/dashboard.page.js
 * ─────────────────────────────────────────────────────────────
 * Render halaman Dashboard: stat cards, alert, chart, recent tx.
 * ─────────────────────────────────────────────────────────────
 */

import ENV from "../env.js";
import {
  state, byMonth, incSum, expSum,
  getSisaSaldo, getTotalInvestasi, autoRollover,
} from "../services/transaction.service.js";
import { rp, rpFull, txRowHTML, gc, renderTrendChart, activeChartPeriod } from "../ui.helpers.js";

const MO  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

export async function renderDashboard() {
  // Rollover jika bulan berganti
  await autoRollover();

  // Cari bulan paling baru yang punya data
  const now = new Date();
  let dashY = now.getFullYear(), dashM = now.getMonth();
  for (let i = 0; i < 12; i++) {
    let y = dashY, m = dashM - i;
    if (m < 0) { m += 12; y--; }
    if (byMonth(y, m).length > 0) { dashY = y; dashM = m; break; }
  }

  const mo  = byMonth(dashY, dashM);
  const inc = incSum(mo), exp = expSum(mo);
  const sisaSaldo     = getSisaSaldo();
  const totalInvestasi = getTotalInvestasi();
  const investasiCount = state.transactions.filter(t => t.cat === "Investasi").length;

  const labelM = state.transactions.length === 0 ? now.getMonth() : dashM;
  const labelY = state.transactions.length === 0 ? now.getFullYear() : dashY;
  document.getElementById("dashMonth").textContent = MO[labelM] + " " + labelY;

  // ── Stat cards ──────────────────────────────────────────────
  const stats = [
    { lbl: "Pemasukan",   val: rpFull(inc),         ch: inc > 0 ? "▲ bulan ini" : "—",   dir: inc > 0 ? "up" : "neutral",      bg: "var(--teal-bg)",   ic: "var(--teal)",   ico: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
    { lbl: "Pengeluaran", val: rpFull(exp),          ch: exp > 0 ? "▼ bulan ini" : "—",   dir: exp > 0 ? "down" : "neutral",    bg: "var(--rose-bg)",   ic: "var(--rose)",   ico: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
    { lbl: "Sisa Saldo",  val: rpFull(sisaSaldo),   ch: state.saldoAwal > 0 ? `+ saldo awal ${rpFull(state.saldoAwal)}` : (sisaSaldo > 0 ? "▲ akumulasi" : "—"), dir: sisaSaldo >= 0 ? "up" : "neutral", bg: "var(--violet-bg)", ic: "var(--violet)", ico: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M16 12h2"/><path d="M2 10h20"/></svg>' },
    { lbl: "Investasi",   val: rpFull(totalInvestasi), ch: investasiCount > 0 ? `+${investasiCount} transaksi` : `Modal awal ${rpFull(state.investasiAwal)}`, dir: totalInvestasi > 0 ? "up" : "neutral", bg: "var(--blue-bg)", ic: "var(--blue)", ico: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>', extra: true },
  ];

  document.getElementById("dashStats").innerHTML = stats.map((s) => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${s.bg};color:${s.ic}">${s.ico}</div>
      <div class="stat-label">${s.lbl}</div>
      <div class="stat-val" style="color:${s.ic}">${s.val}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
        <div class="stat-change ${s.dir}">${s.ch}</div>
        ${s.extra ? `<button onclick="window.__openTarikModal()" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:6px;border:1.5px solid rgba(59,130,246,0.3);background:var(--blue-bg);color:var(--blue);cursor:pointer;white-space:nowrap;">Tarik Dana</button>` : ""}
      </div>
    </div>`).join("");

  // ── Alert ────────────────────────────────────────────────────
  const alertEl = document.getElementById("dashAlert");
  const deficit = exp - inc;
  if (ENV.features.deficitAlert && exp > 0 && exp > inc) {
    const topCatEntry = Object.entries(
      mo.filter(t => t.type === "out")
        .reduce((m, t) => { m[t.cat] = (m[t.cat] || 0) + t.amount; return m; }, {})
    ).sort((a, b) => b[1] - a[1])[0];
    const topCat   = topCatEntry ? topCatEntry[0] : "—";
    const pctLabel = inc > 0 ? ` (${Math.round(deficit / inc * 100)}% lebih besar dari pemasukan)` : "";
    alertEl.innerHTML = `<div class="alert-banner alert-danger">
      <div class="alert-icon" style="background:var(--rose-bg)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <div class="alert-body">
        <div class="alert-title" style="color:var(--rose)">⚠️ Pengeluaran melebihi pemasukan!</div>
        <div class="alert-desc" style="color:#9B2335;">Bulan ini kamu <strong>defisit ${rpFull(deficit)}</strong>${pctLabel}. Pengeluaran terbesar di kategori <strong>${topCat}</strong>.</div>
      </div>
      <button class="alert-close" onclick="this.closest('.alert-banner').remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  } else if (ENV.features.budgetWarning && inc > 0 && exp >= inc * (ENV.threshold.warnPct / 100)) {
    const sisaPct = 100 - Math.round(exp / inc * 100);
    alertEl.innerHTML = `<div class="alert-banner alert-warning">
      <div class="alert-icon" style="background:var(--amber-bg)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div class="alert-body">
        <div class="alert-title" style="color:var(--amber)">Pengeluaran mendekati batas!</div>
        <div class="alert-desc" style="color:#92400E;">Sudah <strong>${Math.round(exp / inc * 100)}%</strong> dari pemasukan. Sisa <strong>${rpFull(inc - exp)}</strong> (${sisaPct}%).</div>
      </div>
      <button class="alert-close" onclick="this.closest('.alert-banner').remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  } else {
    alertEl.innerHTML = "";
  }

  // ── Recent tx ────────────────────────────────────────────────
  const recent = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  document.getElementById("dashTx").innerHTML = recent.length
    ? recent.map(txRowHTML).join("")
    : '<div class="tx-empty">Belum ada transaksi. Tekan + untuk menambah.</div>';

  // ── Category breakdown ───────────────────────────────────────
  const catMap = {};
  mo.filter(t => t.type === "out").forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + t.amount; });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mx = sorted[0]?.[1] || 1;
  document.getElementById("dashCat").innerHTML = sorted.length
    ? sorted.map(([n, v]) => {
        const m = gc(n), pct = Math.round(v / mx * 100);
        return `<div class="cat-row">
          <div class="cat-ico" style="background:${m.bg};color:${m.c}">${m.ico}</div>
          <div class="cat-name">${n}</div>
          <div class="cat-bar-wrap"><div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${m.c}"></div></div><div class="cat-pct">${pct}%</div></div>
          <div class="cat-val">${rp(v)}</div>
        </div>`;
      }).join("")
    : '<div class="tx-empty">Belum ada pengeluaran bulan ini.</div>';

  // ── Chart ────────────────────────────────────────────────────
  renderTrendChart(activeChartPeriod, state.transactions, incSum, expSum, byMonth);
}