/**
 * js/ui.helpers.js
 * ─────────────────────────────────────────────────────────────
 * Utilitas UI murni: format angka, render toast, chart, dll.
 * Tidak mengandung business logic — hanya presentasi.
 * ─────────────────────────────────────────────────────────────
 */

// ── Format angka ───────────────────────────────────────────────

/** Format Rupiah ringkas: 1.5jt, 500rb, dll */
export function rp(n, compact = true) {
  if (n < 0) return "-" + rp(-n, compact);
  if (compact && n >= 1e9) return "Rp " + (n / 1e9).toFixed(1) + "M";
  if (compact && n >= 1e6) return "Rp " + (n / 1e6).toFixed(1) + "jt";
  if (compact && n >= 1e3) return "Rp " + (n / 1e3).toFixed(0) + "rb";
  return "Rp " + n.toLocaleString("id-ID");
}

/** Format Rupiah lengkap tanpa singkatan */
export function rpFull(n) {
  if (n < 0) return "-Rp " + Math.abs(n).toLocaleString("id-ID");
  return "Rp " + n.toLocaleString("id-ID");
}

/** Format tanggal: "25 Jan" */
export function fd(d) {
  const dt = new Date(d);
  return dt.getDate() + " " + ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][dt.getMonth()];
}

/** Parse string nominal (dengan titik separator) ke integer */
export function parseAmt(str) {
  if (!str) return 0;
  const raw = String(str).replace(/[^\d]/g, "");
  const num = parseInt(raw, 10);
  return isNaN(num) || num <= 0 ? 0 : num;
}

/** Format input nominal — tambah titik pemisah ribuan saat mengetik */
export function formatAmtInput(el) {
  const raw = el.value.replace(/[^\d]/g, "");
  const num = parseInt(raw, 10);
  el.value  = raw ? num.toLocaleString("id-ID") : "";
}

// ── Kategori metadata ──────────────────────────────────────────

export const CATEGORY_META = {
  Makanan:      { c: "#E84B6A", bg: "#FDEEF2", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>' },
  Transportasi: { c: "#7C5CFC", bg: "#EEE9FF", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' },
  Belanja:      { c: "#D97706", bg: "#FEF3E2", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
  Kesehatan:    { c: "#0EA882", bg: "#E6F7F3", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>' },
  Hiburan:      { c: "#7C5CFC", bg: "#EEE9FF", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>' },
  Pendidikan:   { c: "#3B82F6", bg: "#EBF3FF", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
  Gaji:         { c: "#0EA882", bg: "#E6F7F3", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' },
  Freelance:    { c: "#D97706", bg: "#FEF3E2", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' },
  Investasi:    { c: "#3B82F6", bg: "#EBF3FF", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
  Lainnya:      { c: "#6B6560", bg: "#F0EDE9", ico: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>' },
};

export const gc = name => CATEGORY_META[name] ?? CATEGORY_META.Lainnya;

// ── Render transaction row HTML ────────────────────────────────
export function txRowHTML(t) {
  const m = gc(t.cat);
  return `<div class="tx-row">
    <div class="tx-ico" style="background:${m.bg};color:${m.c}">${m.ico}</div>
    <div class="tx-body">
      <div class="tx-name">${t.name}</div>
      <div class="tx-meta">${fd(t.date)} <span class="tx-cat">${t.cat}</span>${t.note ? ` <span class="tx-note">${t.note}</span>` : ""}</div>
    </div>
    <div class="tx-amount ${t.type === "in" ? "tx-in" : "tx-out"}">${t.type === "in" ? "+" : "-"}${rp(t.amount)}</div>
  </div>`;
}

// ── Toast ──────────────────────────────────────────────────────
let _toastTimer;
export function showToast(msg, type = "ok") {
  const el   = document.getElementById("toast");
  const icon = type === "err"
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0EA882" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';
  el.innerHTML = icon + msg;
  el.classList.add("on");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("on"), 3200);
}

// ── Toggle password visibility ─────────────────────────────────
export function togglePw(inputId, btn) {
  const inp    = document.getElementById(inputId);
  const hidden = inp.type === "password";
  inp.type     = hidden ? "text" : "password";
  btn.querySelector("svg").innerHTML = hidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

// ── Chart.js trend chart ───────────────────────────────────────
const MO = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
let _chartInstance = null;
export let activeChartPeriod = "7d";

export function renderTrendChart(period, txs, incSumFn, expSumFn, byMonthFn) {
  activeChartPeriod = period;
  const now = new Date();
  let labels = [], incData = [], expData = [];

  if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const day = txs.filter(t => t.date === ds);
      labels.push(["Min","Sen","Sel","Rab","Kam","Jum","Sab"][d.getDay()]);
      incData.push(incSumFn(day)); expData.push(expSumFn(day));
    }
  } else if (period === "30d") {
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * 5);
      const start = new Date(end); start.setDate(start.getDate() - 4);
      const range = txs.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
      labels.push(start.getDate() + "–" + end.getDate());
      incData.push(incSumFn(range)); expData.push(expSumFn(range));
    }
  } else if (period === "3m") {
    for (let i = 2; i >= 0; i--) {
      let m = now.getMonth() - i, y = now.getFullYear();
      if (m < 0) { m += 12; y--; }
      const mTx = byMonthFn(y, m);
      labels.push(MO[m]);
      incData.push(incSumFn(mTx)); expData.push(expSumFn(mTx));
    }
  }

  const ctx = document.getElementById("trendChart");
  if (!ctx) return;
  if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }

  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.period === period)
  );

  _chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Pemasukan",   data: incData, borderColor: "#0EA882", backgroundColor: "rgba(14,168,130,0.08)", borderWidth: 2.5, pointBackgroundColor: "#0EA882", pointRadius: 4, pointHoverRadius: 6, fill: true, tension: 0.4 },
        { label: "Pengeluaran", data: expData, borderColor: "#E84B6A", backgroundColor: "rgba(232,75,106,0.06)", borderWidth: 2.5, pointBackgroundColor: "#E84B6A", pointRadius: 4, pointHoverRadius: 6, fill: true, tension: 0.4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)", borderWidth: 1,
          titleColor: "#1A1714", bodyColor: "#6B6560",
          titleFont: { family: "'Plus Jakarta Sans'", weight: "700", size: 12 },
          bodyFont:  { family: "'Plus Jakarta Sans'", size: 11 },
          padding: 10,
          callbacks: { label: c => ` ${c.dataset.label}: ${rpFull(c.raw)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10, weight: "500" }, color: "#ABA6A0" } },
        y: { grid: { color: "rgba(0,0,0,0.04)" }, border: { display: false }, ticks: { font: { family: "'Plus Jakarta Sans'", size: 10, weight: "500" }, color: "#ABA6A0", callback: v => v === 0 ? "0" : rp(v), maxTicksLimit: 5 } },
      },
    },
  });
}

// ── Skeleton HTML untuk loading state ─────────────────────────
export function skeletonTxRows(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-row">
      <div class="skeleton skeleton-ico"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-40"></div>
      </div>
      <div class="skeleton skeleton-amt"></div>
    </div>`).join("");
}