/**
 * js/app.js
 * ─────────────────────────────────────────────────────────────
 * Entry point aplikasi. Mengorkestrasi:
 *   - Login / register flow
 *   - Navigasi antar halaman
 *   - Modal tambah transaksi & tarik dana
 *   - Dialog konfirmasi defisit
 * ─────────────────────────────────────────────────────────────
 */

import { login as authLogin, register as authRegister, makeUID } from "./services/auth.service.js";
import { loadUserData }   from "./services/firebase.service.js";
import {
  state, initState, resetState, addTransaction, tarikInvestasi,
  checkDefisit, clearAll as clearAllTx, exportCSV, getTotalInvestasi,
} from "./services/transaction.service.js";
import { renderDashboard }   from "./pages/dashboard.page.js";
import { renderTxPage, setFType, setFCat, setSortOrd } from "./pages/transaksi.page.js";
import { renderBudget }      from "./pages/anggaran.page.js";
import { renderReport, shiftMonth } from "./pages/laporan.page.js";
import {
  loadPengaturanPage, previewSaldo, previewInvestasi,
  saveSaldoAwal, saveInvestasiAwal, doChangePassword,
} from "./pages/pengaturan.page.js";
import {
  showToast, togglePw, formatAmtInput, parseAmt, rpFull,
  renderTrendChart, activeChartPeriod,
} from "./ui.helpers.js";

// ── Current page ───────────────────────────────────────────────
let curPage = "dashboard";
let txType  = "out";

// ── Navigation ─────────────────────────────────────────────────
window.goTo = function(p, btn) {
  curPage = p;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  document.getElementById("pg-" + p).classList.add("active");
  document.querySelectorAll(".nav-link").forEach(el => el.classList.remove("active"));
  if (btn) btn.classList.add("active");
  else document.querySelectorAll(".nav-link").forEach(el => {
    if (el.getAttribute("onclick")?.includes("'" + p + "'")) el.classList.add("active");
  });
  document.querySelectorAll(".mob-item").forEach(el => el.classList.remove("active"));
  const mi = document.getElementById("mn-" + p);
  if (mi) mi.classList.add("active");
  closeSidebar();
  if (p === "dashboard")   renderDashboard();
  if (p === "transaksi")   renderTxPage();
  if (p === "anggaran")    renderBudget();
  if (p === "laporan")     renderReport();
  if (p === "pengaturan")  loadPengaturanPage();
};

// ── Sidebar ────────────────────────────────────────────────────
window.openSidebar  = () => { document.getElementById("sidebar").classList.add("open"); document.getElementById("scrim").classList.add("open"); };
window.closeSidebar = () => { document.getElementById("sidebar").classList.remove("open"); document.getElementById("scrim").classList.remove("open"); };

// ── Chart tab ──────────────────────────────────────────────────
window.switchChartTab = (el, period) => {
  renderTrendChart(period, state.transactions,
    arr => arr.filter(t => t.type === "in").reduce((s, t) => s + t.amount, 0),
    arr => arr.filter(t => t.type === "out").reduce((s, t) => s + t.amount, 0),
    (y, m) => state.transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === y && d.getMonth() === m; })
  );
};

// ── Modal transaksi ────────────────────────────────────────────
window.openModal = () => {
  document.getElementById("fDate").valueAsDate = new Date();
  txType = "out";
  document.getElementById("tOut").className = "type-opt sel-out";
  document.getElementById("tIn").className  = "type-opt";
  const ap = document.getElementById("amtPreview");
  if (ap) ap.textContent = "";
  document.getElementById("fAmt").value  = "";
  document.getElementById("fName").value = "";
  document.getElementById("fNote").value = "";
  document.getElementById("modalWrap").classList.add("open");
};
window.closeModal = () => document.getElementById("modalWrap").classList.remove("open");
window.setTxType  = t => {
  txType = t;
  document.getElementById("tOut").className = "type-opt" + (t === "out" ? " sel-out" : "");
  document.getElementById("tIn").className  = "type-opt" + (t === "in"  ? " sel-in"  : "");
};

window.updateAmtPreview = () => {
  const amt = parseAmt(document.getElementById("fAmt").value);
  const el  = document.getElementById("amtPreview");
  if (!el) return;
  el.textContent = amt > 0 ? "= " + rpFull(amt) : "";
  el.style.color = "var(--teal)";
  el.style.fontWeight = "600";
};

window.submitTx = async () => {
  const name = document.getElementById("fName").value.trim();
  const amt  = parseAmt(document.getElementById("fAmt").value);
  const cat  = document.getElementById("fCat").value;
  const date = document.getElementById("fDate").value;
  const note = document.getElementById("fNote").value.trim();

  if (!name) {
    document.getElementById("fName").style.borderColor = "var(--rose)";
    setTimeout(() => document.getElementById("fName").style.borderColor = "", 1600);
    showToast("Isi nama transaksi!", "err"); return;
  }
  if (!amt || amt <= 0) {
    document.getElementById("fAmt").style.borderColor = "var(--rose)";
    setTimeout(() => document.getElementById("fAmt").style.borderColor = "", 1600);
    showToast("Masukkan jumlah yang valid!", "err"); return;
  }

  const payload = { name, cat, amount: amt, date, type: txType, note };

  // Cek defisit dulu
  if (txType === "out") {
    const defisit = checkDefisit(amt);
    if (defisit) {
      showDefisitDialog(defisit, payload);
      return;
    }
  }

  await _doSaveTx(payload);
};

async function _doSaveTx(payload) {
  const result = await addTransaction(payload);
  if (!result.success) { showToast(result.error, "err"); return; }
  closeModal();
  _refreshCurrentPage();
  showToast(`${payload.type === "in" ? "Pemasukan" : "Pengeluaran"} ${rpFull(payload.amount)} berhasil ditambahkan!`);
}

function _refreshCurrentPage() {
  if (curPage === "dashboard")  renderDashboard();
  if (curPage === "transaksi")  renderTxPage();
  if (curPage === "anggaran")   renderBudget();
  if (curPage === "laporan")    renderReport();
}

// ── Dialog defisit ─────────────────────────────────────────────
let _defisitPayload = null;

function showDefisitDialog({ sisaSaldo, defisitSetelah }, payload) {
  _defisitPayload = payload;
  document.getElementById("alertDefisitMsg").innerHTML =
    `Pengeluaran <strong>${rpFull(payload.amount)}</strong> melebihi sisa saldo kamu.<br>
    Kamu akan masuk <strong style="color:var(--rose)">defisit</strong> jika tetap dilanjutkan.`;
  document.getElementById("alertSisaSaldo").textContent   = rpFull(sisaSaldo);
  document.getElementById("alertPengeluaran").textContent = "-" + rpFull(payload.amount);
  document.getElementById("alertDefisit").textContent     = rpFull(Math.abs(defisitSetelah));
  document.getElementById("alertDefisitWrap").classList.add("open");
}
window.closeAlertDefisit = () => document.getElementById("alertDefisitWrap").classList.remove("open");
window.confirmDefisit    = async () => {
  closeModal();
  window.closeAlertDefisit();
  if (_defisitPayload) { await _doSaveTx(_defisitPayload); _defisitPayload = null; }
};

// ── Modal tarik dana ───────────────────────────────────────────
window.__openTarikModal = window.openTarikModal = () => {
  const total = getTotalInvestasi();
  document.getElementById("tarikInvestasiTotal").textContent = rpFull(total);
  document.getElementById("tarikAmt").value  = "";
  document.getElementById("tarikNote").value = "";
  document.getElementById("tarikDate").valueAsDate = new Date();
  document.getElementById("tarikSisa").textContent = rpFull(total);
  document.getElementById("tarikModalWrap").classList.add("open");
};
window.closeTarikModal = () => document.getElementById("tarikModalWrap").classList.remove("open");

window.updateTarikSisa = () => {
  const total = getTotalInvestasi();
  const tarik = parseAmt(document.getElementById("tarikAmt").value || "0");
  const sisa  = total - tarik;
  const el    = document.getElementById("tarikSisa");
  el.textContent = rpFull(sisa);
  el.style.color = sisa < 0 ? "var(--rose)" : "var(--blue)";
};

window.submitTarik = async () => {
  const amt  = parseAmt(document.getElementById("tarikAmt").value || "0");
  const date = document.getElementById("tarikDate").value;
  const note = document.getElementById("tarikNote").value.trim();
  const result = await tarikInvestasi({ amount: amt, date, note });
  if (!result.success) { showToast(result.error, "err"); return; }
  window.closeTarikModal();
  _refreshCurrentPage();
  showToast(`${rpFull(amt)} berhasil ditarik dari investasi!`);
};

// ── Filter & sort wiring ───────────────────────────────────────
window.setFType = el => {
  document.querySelectorAll("#filterBar [data-ft]").forEach(e => e.classList.remove("on"));
  el.classList.add("on");
  setFType(el.dataset.ft);
};
window.setFCat = el => {
  document.querySelectorAll("#filterBar [data-fc]").forEach(e => e.classList.remove("on"));
  el.classList.add("on");
  setFCat(el.dataset.fc);
};

// ── Pengaturan wiring ──────────────────────────────────────────
window.previewSaldo      = previewSaldo;
window.previewInvestasi  = previewInvestasi;
window.saveSaldoAwal     = saveSaldoAwal;
window.saveInvestasiAwal = saveInvestasiAwal;
window.changePassword    = doChangePassword;
window.clearAll          = async () => {
  if (!confirm("Hapus semua transaksi? Tidak dapat dibatalkan.")) return;
  await clearAllTx();
  _refreshCurrentPage();
  showToast("Semua transaksi dihapus");
};
window.exportCSV = exportCSV;

// ── Format input wiring ────────────────────────────────────────
window.formatAmtInput = formatAmtInput;
window.formatInvInput = formatAmtInput;
window.formatTarikInput = formatAmtInput;

// ── Laporan wiring ─────────────────────────────────────────────
window.shiftMonth = shiftMonth;

// ── Toggle password ────────────────────────────────────────────
window.togglePw = togglePw;

// ── Render tx page on search/sort ─────────────────────────────
window.renderTxPage = renderTxPage;

// ── Login / register ───────────────────────────────────────────
window.showPanel = panel => {
  document.getElementById("panelLogin").style.display    = panel === "login"    ? "" : "none";
  document.getElementById("panelRegister").style.display = panel === "register" ? "" : "none";
  document.getElementById("loginError").style.display    = "none";
  document.getElementById("regError").style.display      = "none";
  ["loginUsername","loginPassword","regUsername","regPassword","regPassword2"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  const focus = panel === "login" ? "loginUsername" : "regUsername";
  document.getElementById(focus)?.focus();
};

window.doLogin = async () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  document.getElementById("loginError").style.display = "none";

  const _showErr = msg => {
    const el = document.getElementById("loginError");
    el.textContent = msg; el.style.display = "";
  };

  const result = await authLogin(username, password);
  if (!result.success) { _showErr(result.error); return; }

  await _loginSuccess(username, result.uid);
};

window.doRegister = async () => {
  const username  = document.getElementById("regUsername").value.trim();
  const password  = document.getElementById("regPassword").value;
  const password2 = document.getElementById("regPassword2").value;
  document.getElementById("regError").style.display = "none";

  const _showErr = msg => {
    const el = document.getElementById("regError");
    el.textContent = msg; el.style.display = "";
  };

  const result = await authRegister(username, password, password2);
  if (!result.success) { _showErr(result.error); return; }

  await _loginSuccess(username, result.uid);
};

async function _loginSuccess(username, uid) {
  // Simpan session biar tidak balik ke login pas refresh
  localStorage.setItem("dompet_session", JSON.stringify({ username, uid }));

  // Muat data dari Firebase
  let data;
  try {
    data = await loadUserData(uid);
  } catch {
    // Offline fallback
    const { loadFromCache } = await import("./services/transaction.service.js");
    data = loadFromCache(username);
  }

  initState(uid, username, data);

  // Update sidebar
  document.getElementById("sidebarAvatar").textContent = username.slice(0, 2).toUpperCase();
  document.getElementById("sidebarName").textContent   = username;
  document.getElementById("loginScreen").classList.add("hidden");

  // Render halaman awal
  window.goTo("dashboard", null);
}

window.logout = () => {
  if (!confirm("Keluar dari akun ini?")) return;
  localStorage.removeItem("dompet_session");
  resetState();
  document.getElementById("loginScreen").classList.remove("hidden");
  window.showPanel("login");
};

// ── Scrim / modal click-outside ────────────────────────────────
document.getElementById("alertDefisitWrap")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) window.closeAlertDefisit();
});
document.getElementById("modalWrap")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) window.closeModal();
});
document.getElementById("tarikModalWrap")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) window.closeTarikModal();
});

// ── Bootstrap — restore session kalau ada ─────────────────────
(async () => {
  try {
    const raw = localStorage.getItem("dompet_session");
    if (raw) {
      const { username, uid } = JSON.parse(raw);
      if (username && uid) {
        // Langsung masuk tanpa perlu login ulang
        await _loginSuccess(username, uid);
        return;
      }
    }
  } catch {
    localStorage.removeItem("dompet_session");
  }
  // Tidak ada session — tampilkan login
  window.showPanel("login");
})();
