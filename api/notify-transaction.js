// api/notify-transaction.cjs
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, tx } = req.body;
  if (!uid || !tx) return res.status(400).json({ error: "Missing params" });

  try {
    const tokensSnap = await db.ref(`users/${uid}/fcm_tokens`).get();
    if (!tokensSnap.exists()) return res.json({ sent: 0 });

    const tokens = Object.values(tokensSnap.val()).map(t => t.token).filter(Boolean);
    if (!tokens.length) return res.json({ sent: 0 });

    const isIn  = tx.type === "in";
    const emoji = isIn ? "💰" : "💸";
    const label = isIn ? "Pemasukan" : "Pengeluaran";
    const sign  = isIn ? "+" : "-";
    const amt   = new Intl.NumberFormat("id-ID").format(tx.amount);

    const title = `${emoji} ${label} dicatat!`;
    const body  = `${tx.name} · ${sign}Rp ${amt}`;

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon:    "https://dompet-five.vercel.app/icon-512.png",
          badge:   "https://dompet-five.vercel.app/icon-192.png",
          vibrate: [100],
        },
        fcmOptions: { link: "https://dompet-five.vercel.app" },
      },
    });

    // Hapus token expired
    result.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
        const key = tokens[i].replace(/[.#$[\]]/g, "_").slice(0, 100);
        db.ref(`users/${uid}/fcm_tokens/${key}`).remove().catch(console.warn);
      }
    });

    return res.json({ success: true, sent: result.successCount });
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).json({ error: e.message });
  }
};