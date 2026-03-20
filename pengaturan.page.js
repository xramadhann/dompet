/**
 * pages/pengaturan.page.js
 */
import { state, updateSaldoAwal, updateInvestasiAwal, incSum, expSum, getTotalInvestasi } from "../services/transaction.service.js";
import { changePassword } from "../services/auth.service.js";
import { rp, rpFull, parseAmt, formatAmtInput, showToast } from "../ui.helpers.js";

export function loadPengaturanPage() {
  const elU = document.getElementById("profileUsername");
  if (elU) elU.value = state.username || "";

  const elS = document.getElementById("saldoAwalInput");
  if (elS) elS.value = state.saldoAwal || "";

  const elI = document.getElementById("investasiAwalInput");
  if (elI) elI.value = state.investasiAwal ? state.investasiAwal.toLocaleString("id-ID") : "";

  previewSaldo();
  previewInvestasi();

  ["pwOld","pwNew","pwNew2"].forEach(id => {
    const f = document.getElementById(id);
    if (f) f.value = "";
  });
  const msg = document.getElementById("pwChangeMsg");
  if (msg) msg.style.display = "none";
}

export function previewSaldo() {
  const val    = parseFloat(document.getElementById("saldoAwalInput")?.value) || 0;
  const allInc = incSum(state.transactions), allExp = expSum(state.transactions);
  const total  = val + allInc - allExp;
  const prev   = document.getElementById("saldoPreview");
  if (prev) prev.textContent = rp(total, false);
  const bd = document.getElementById("saldoBreakdown");
  const parts = [];
  if (val > 0)    parts.push(`Saldo awal ${rp(val)}`);
  if (allInc > 0) parts.push(`+ pemasukan ${rp(allInc)}`);
  if (allExp > 0) parts.push(`− pengeluaran ${rp(allExp)}`);
  if (bd) bd.textContent = parts.length ? parts.join(" ") : "Saldo awal + pemasukan − pengeluaran";
}

export function previewInvestasi() {
  const val  = parseAmt(document.getElementById("investasiAwalInput")?.value || "0");
  const txInv = state.transactions.filter(t => t.cat === "Investasi")
    .reduce((s, t) => t.type === "out" ? s + t.amount : s - t.amount, 0);
  const total = val + txInv;
  const prev  = document.getElementById("investasiPreview");
  if (prev) prev.textContent = total.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const parts = [`Nilai awal ${rp(val)}`];
  if (txInv > 0) parts.push(`+ tambahan ${rp(txInv)}`);
  const bd = document.getElementById("investasiBreakdown");
  if (bd) bd.textContent = parts.join(" ");
}

export async function saveSaldoAwal() {
  const val = parseFloat(document.getElementById("saldoAwalInput")?.value);
  if (isNaN(val) || val < 0) { showToast("Masukkan nominal yang valid", "err"); return; }
  await updateSaldoAwal(val);
  showToast("Saldo awal berhasil disimpan!");
}

export async function saveInvestasiAwal() {
  const val = parseAmt(document.getElementById("investasiAwalInput")?.value || "0");
  if (isNaN(val) || val < 0) { showToast("Masukkan nominal yang valid", "err"); return; }
  await updateInvestasiAwal(val);
  showToast("Investasi awal berhasil disimpan!");
}

export async function doChangePassword() {
  const old  = document.getElementById("pwOld")?.value  || "";
  const pw1  = document.getElementById("pwNew")?.value  || "";
  const pw2  = document.getElementById("pwNew2")?.value || "";
  const msg  = document.getElementById("pwChangeMsg");

  const show = (text, ok) => {
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = ok ? "var(--teal)" : "var(--rose)";
    msg.style.display = "";
  };

  const result = await changePassword(state.username, old, pw1, pw2);
  if (!result.success) { show(result.error, false); return; }

  ["pwOld","pwNew","pwNew2"].forEach(id => { const f = document.getElementById(id); if (f) f.value = ""; });
  show("Password berhasil diubah!", true);
  showToast("Password berhasil diubah!");
}
