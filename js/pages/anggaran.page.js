/**
 * pages/anggaran.page.js
 */
import ENV from "../env.js";
import { state, byMonth, expSum } from "../services/transaction.service.js";
import { rp, gc } from "../ui.helpers.js";

export function renderBudget() {
  const now = new Date();
  let bY = now.getFullYear(), bM = now.getMonth();
  for (let i = 0; i < 6; i++) {
    let y = bY, m = bM - i;
    if (m < 0) { m += 12; y--; }
    if (byMonth(y, m).length > 0) { bY = y; bM = m; break; }
  }
  const mo = byMonth(bY, bM);
  const spent = {};
  mo.filter(t => t.type === "out").forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + t.amount; });

  const budgetDefs = [
    { cat: "Makanan",      limit: ENV.budget.makanan },
    { cat: "Transportasi", limit: ENV.budget.transportasi },
    { cat: "Investasi",    limit: ENV.budget.investasi },
  ];

  document.getElementById("budgetGrid").innerHTML = budgetDefs.map(b => {
    const s = spent[b.cat] || 0, pct = Math.min(Math.round(s / b.limit * 100), 100), warn = pct >= 85;
    const m = gc(b.cat);
    const pillStyle = warn
      ? "background:var(--rose-bg);color:var(--rose)"
      : pct >= 60 ? "background:var(--amber-bg);color:var(--amber)"
      : "background:var(--teal-bg);color:var(--teal)";
    const barColor = warn ? "var(--rose)" : pct >= 60 ? "var(--amber)" : m.c;
    return `<div class="budget-item">
      <div class="budget-top">
        <div class="budget-ico" style="background:${m.bg};color:${m.c}">${m.ico}</div>
        <div class="budget-pct-pill" style="${pillStyle}">${pct}%</div>
      </div>
      <div class="budget-cat">${b.cat}</div>
      <div class="budget-spent" style="color:${warn ? "var(--rose)" : "var(--ink)"}">${rp(s)}</div>
      <div class="budget-limit">dari ${rp(b.limit)}</div>
      <div class="budget-track"><div class="budget-fill" style="width:${pct}%;background:${barColor}"></div></div>
    </div>`;
  }).join("");
}
