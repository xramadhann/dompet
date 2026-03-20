/**
 * pages/transaksi.page.js
 */
import { state, incSum, expSum } from "../services/transaction.service.js";
import { rp, rpFull, txRowHTML } from "../ui.helpers.js";

export let fType = "all", fCat = "all", sortOrd = "newest";

export function setFType(t) { fType = t; renderTxPage(); }
export function setFCat(c)  { fCat  = c; renderTxPage(); }
export function setSortOrd(o){ sortOrd = o; renderTxPage(); }

export function renderTxPage() {
  const q = (document.getElementById("searchQ")?.value || "").toLowerCase();
  let f = state.transactions.filter(t => {
    if (fType === "in"  && t.type !== "in")   return false;
    if (fType === "out" && t.type !== "out")  return false;
    if (fCat  !== "all" && t.cat !== fCat)   return false;
    if (q && !t.name.toLowerCase().includes(q) && !t.cat.toLowerCase().includes(q)) return false;
    return true;
  });
  if (sortOrd === "newest")  f.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sortOrd === "oldest")  f.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortOrd === "highest") f.sort((a, b) => b.amount - a.amount);
  if (sortOrd === "lowest")  f.sort((a, b) => a.amount - b.amount);

  const cnt = document.getElementById("txCount");
  if (cnt) cnt.textContent = f.length + " transaksi";
  const sub = document.getElementById("txSubLabel");
  if (sub) sub.textContent = state.transactions.length + " total transaksi";
  document.getElementById("txList").innerHTML = f.length
    ? f.map(txRowHTML).join("")
    : '<div class="tx-empty">Tidak ada transaksi yang sesuai</div>';
}
