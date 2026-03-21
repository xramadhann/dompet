// api/notify-threshold.cjs
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  });
}

const db        = admin.database();
const messaging = admin.messaging();

const THRESHOLDS = [
  { pct: 50,  emoji: "💸", level: "warning" },
  { pct: 75,  emoji: "⚠️", level: "danger" },
  { pct: 90,  emoji: "🚨", level: "critical" },
  { pct: 100, emoji: "🔴", level: "over" },
];

function buildNotif(threshold, realPct) {
  const { emoji, level } = threshold;
  const title = level === "over"
    ? `${emoji} Budget Habis! (${realPct}%)`
    : `${emoji} Pengeluaran Sudah ${realPct}%!`;
  const body = level === "over"
    ? `Pengeluaran bulan ini sudah ${realPct}% dari pemasukan, kamu defisit!`
    : level === "critical"
    ? `Pengeluaran bulan ini sudah ${realPct}% dari pemasukan, hati-hati!`
    : `Pengeluaran bulan ini sudah ${realPct}% dari pemasukan, jangan boros-boros ya!`;
  return { title, body };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, totalIncome, totalExpense } = req.body;
  if (!uid || !totalIncome || totalExpense === undefined) {
    return res.status(400).json({ error: "Missing params" });
  }

  const pct   = Math.round((totalExpense / totalIncome) * 100);
  const today = new Date().toISOString().slice(0, 7);

  try {
    const tokensSnap = await db.ref(`users/${uid}/fcm_tokens`).get();
    if (!tokensSnap.exists()) return res.json({ sent: 0 });

    const tokens = Object.values(tokensSnap.val()).map(t => t.token).filter(Boolean);
    if (!tokens.length) return res.json({ sent: 0 });

    let totalSent = 0;

    for (const t of THRESHOLDS) {
      if (pct < t.pct) continue;

      const flagKey  = `${today}_${t.pct}`;
      const flagSnap = await db.ref(`users/${uid}/notif_sent/${flagKey}`).get();
      if (flagSnap.exists()) continue;

      const { title, body } = buildNotif(t, pct);
      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        webpush: {
          notification: {
            icon:    "https://dompet-five.vercel.app/icon-512.png",
            badge:   "https://dompet-five.vercel.app/icon-192.png",
            vibrate: [200, 100, 200],
          },
          fcmOptions: { link: "https://dompet-five.vercel.app" },
        },
      });

      totalSent += result.successCount;
      await db.ref(`users/${uid}/notif_sent/${flagKey}`).set(true);

      result.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          const key = tokens[i].replace(/[.#$[\]]/g, "_").slice(0, 100);
          db.ref(`users/${uid}/fcm_tokens/${key}`).remove().catch(console.warn);
        }
      });
    }

    return res.json({ success: true, pct, sent: totalSent });
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).json({ error: e.message });
  }
};
