// api/notify-morning.js
// Vercel Serverless Function — dipanggil Cron jam 01:00 UTC = 08:00 WIB
// Kirim push notif "jangan lupa catat keuangan" ke semua user

const admin = require("firebase-admin");

// Init Firebase Admin sekali saja
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

export default async function handler(req, res) {
  // Vercel Cron kirim header x-vercel-cron — validasi supaya tidak bisa dipanggil sembarangan
  if (req.headers["x-vercel-cron"] !== "1" && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Ambil semua user
    const usersSnap = await db.ref("users").get();
    if (!usersSnap.exists()) return res.json({ sent: 0 });

    const users   = usersSnap.val();
    const uids    = Object.keys(users);
    let totalSent = 0;

    for (const uid of uids) {
      const tokensData = users[uid]?.fcm_tokens;
      if (!tokensData) continue;

      const tokens = Object.values(tokensData)
        .map(t => t.token)
        .filter(Boolean);

      if (!tokens.length) continue;

      try {
        const result = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title: "📝 Jangan Lupa Catat Keuangan!",
            body:  "Catat pengeluaran dan pemasukan kamu hari ini yuk, biar keuangan tetap terkontrol! 💰",
          },
          webpush: {
            notification: {
              icon:  "https://dompet-five.vercel.app/icon-512.png",
              badge: "https://dompet-five.vercel.app/icon-192.png",
              vibrate: [200, 100, 200],
            },
            fcmOptions: { link: "https://dompet-five.vercel.app" },
          },
        });

        totalSent += result.successCount;

        // Hapus token expired
        result.responses.forEach((r, i) => {
          if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
            const key = tokens[i].replace(/[.#$[\]]/g, "_").slice(0, 100);
            db.ref(`users/${uid}/fcm_tokens/${key}`).remove().catch(console.warn);
          }
        });
      } catch (e) {
        console.error(`Gagal kirim ke ${uid}:`, e.message);
      }
    }

    console.log(`Morning reminder sent: ${totalSent} devices`);
    return res.json({ success: true, sent: totalSent });
  } catch (e) {
    console.error("Error:", e);
    return res.status(500).json({ error: e.message });
  }
}