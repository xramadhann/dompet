/**
 * pages/laporan.page.js
 */
import { state, byMonth, incSum, expSum, getSisaSaldo } from "../services/transaction.service.js";
import { rp, rpFull, txRowHTML, gc } from "../ui.helpers.js";

const MO  = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const MOF = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

export let rptY = new Date().getFullYear(), rptM = new Date().getMonth();

export function shiftMonth(d) {
  rptM += d;
  if (rptM > 11) { rptM = 0; rptY++; }
  if (rptM < 0)  { rptM = 11; rptY--; }
  renderReport();
}

export function renderReport() {
  document.getElementById("rptMonthLabel").textContent = MOF[rptM] + " " + rptY;
  const mo  = byMonth(rptY, rptM);
  const inc = incSum(mo), exp = expSum(mo);

  // Sisa saldo s/d akhir bulan ini
  const txUpTo = state.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() < rptY || (d.getFullYear() === rptY && d.getMonth() <= rptM);
  });
  const sisaSaldoBulanIni = state.saldoAwal + incSum(txUpTo) - expSum(txUpTo);

  const invBulanIni  = mo.filter(t => t.cat === "Investasi" && t.type === "out").reduce((s, t) => s + t.amount, 0);
  const invTarik     = mo.filter(t => t.cat === "Investasi" && t.type === "in").reduce((s, t) => s + t.amount, 0);
  const invNet       = invBulanIni - invTarik;

  document.getElementById("rptStats").innerHTML = [
    { lbl: "Pemasukan",          val: rpFull(inc),              sub: `${mo.filter(t => t.type === "in").length} transaksi masuk`,   bg: "var(--teal-bg)",   c: "var(--teal)" },
    { lbl: "Pengeluaran",        val: rpFull(exp),              sub: `${mo.filter(t => t.type === "out").length} transaksi keluar`,  bg: "var(--rose-bg)",   c: "var(--rose)" },
    { lbl: "Sisa Saldo",         val: rpFull(sisaSaldoBulanIni),sub: `Akumulasi s/d ${MOF[rptM]}`,                                  bg: "var(--violet-bg)", c: "var(--violet)" },
    { lbl: "Investasi Bulan Ini",val: rpFull(invNet),           sub: invBulanIni > 0 ? `+${rpFull(invBulanIni)}${invTarik > 0 ? ` / -${rpFull(invTarik)}` : ""}` : "Belum ada", bg: "var(--blue-bg)", c: "var(--blue)" },
  ].map(s => `<div class="stat-card">
    <div class="stat-label">${s.lbl}</div>
    <div class="stat-val" style="color:${s.c}">${s.val}</div>
    <div class="stat-change neutral" style="font-size:10.5px;margin-top:4px;">${s.sub}</div>
  </div>`).join("");

  // 6-month bars
  const bars = [];
  for (let i = 5; i >= 0; i--) {
    let m = rptM - i, y = rptY;
    if (m < 0) { m += 12; y--; }
    bars.push({ lbl: MO[m], inc: incSum(byMonth(y, m)), exp: expSum(byMonth(y, m)) });
  }
  const maxB = Math.max(...bars.map(b => Math.max(b.inc, b.exp)), 1);
  document.getElementById("rptBars").innerHTML = bars.map(b => {
    const ih = Math.round(b.inc / maxB * 100), eh = Math.round(b.exp / maxB * 100);
    return `<div class="bar-col"><div class="bar-in" style="height:${ih}%"></div><div class="bar-out" style="height:${eh}%"></div></div>`;
  }).join("");
  document.getElementById("rptBarAxis").innerHTML = bars.map(b => `<span>${b.lbl}</span>`).join("");

  // Category breakdown
  const catMap = {};
  mo.filter(t => t.type === "out").forEach(t => { catMap[t.cat] = (catMap[t.cat] || 0) + t.amount; });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const mcv  = cats[0]?.[1] || 1;
  document.getElementById("rptCat").innerHTML = cats.length
    ? cats.map(([n, v]) => {
        const m = gc(n), pct = exp ? Math.round(v / exp * 100) : 0;
        return `<div class="cat-row">
          <div class="cat-ico" style="background:${m.bg};color:${m.c}">${m.ico}</div>
          <div class="cat-name">${n}</div>
          <div class="cat-bar-wrap"><div class="cat-track"><div class="cat-fill" style="width:${Math.round(v / mcv * 100)}%;background:${m.c}"></div></div><div class="cat-pct">${pct}%</div></div>
          <div class="cat-val">${rp(v)}</div>
        </div>`;
      }).join("")
    : '<div class="tx-empty">Tidak ada pengeluaran bulan ini</div>';

  document.getElementById("rptTx").innerHTML = mo.length
    ? [...mo].sort((a, b) => new Date(b.date) - new Date(a.date)).map(txRowHTML).join("")
    : '<div class="tx-empty">Tidak ada transaksi bulan ini</div>';
}
