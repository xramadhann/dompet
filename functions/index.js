/**
 * functions/index.js
 * ─────────────────────────────────────────────────────────────
 * Firebase Cloud Functions:
 * 1. scheduledDailyReminder  — setiap hari jam 08:00 waktu device user
 *                              (dikirim jam 01:00 UTC = 08:00 WIB)
 * 2. onTransactionWrite      — trigger saat transaksi baru masuk,
 *                              cek threshold 50/90/100%
 * ─────────────────────────────────────────────────────────────
 */

const { onSchedule }        = require("firebase-functions/v2/scheduler");
const { onValueWritten }    = require("firebase-functions/v2/database");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");
const { getDatabase }       = require("firebase-admin/database");

initializeApp();

const db        = getDatabase();
const messaging = getMessaging();

// ── Helper: ambil semua FCM token milik satu user ──────────────
async function getTokensForUser(uid) {
  const snap = await db.ref(`users/${uid}/fcm_tokens`).get();
  if (!snap.exists()) return [];
  return Object.values(snap.val()).map(t => t.token).filter(Boolean);
}

// ── Helper: kirim notif ke satu user ──────────────────────────
async function sendToUser(uid, title, body) {
  const tokens = await getTokensForUser(uid);
  if (!tokens.length) return;

  const message = {
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon:  "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
      },
      fcmOptions: { link: "/" },
    },
    tokens,
  };

  const result = await messaging.sendEachForMulticast(message);
  console.log(`[${uid}] Sent: ${result.successCount}, Failed: ${result.failureCount}`);

  // Hapus token yang sudah expired / invalid
  result.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      const badToken = tokens[i].replace(/[.#$[\]]/g, "_").slice(0, 100);
      db.ref(`users/${uid}/fcm_tokens/${badToken}`).remove().catch(console.warn);
    }
  });
}

// ══════════════════════════════════════════════════════════════
// 1. SCHEDULED — setiap hari jam 08:00 WIB (01:00 UTC)
// ══════════════════════════════════════════════════════════════
exports.scheduledDailyReminder = onSchedule(
  {
    schedule:  "0 1 * * *", // cron: jam 01:00 UTC = 08:00 WIB
    timeZone:  "UTC",
    region:    "asia-southeast1",
  },
  async () => {
    console.log("Running daily reminder...");

    // Ambil semua user
    const usersSnap = await db.ref("users").get();
    if (!usersSnap.exists()) return;

    const users = usersSnap.val();
    const promises = Object.keys(users).map(uid =>
      sendToUser(
        uid,
        "📝 Jangan Lupa Catat Keuangan!",
        "Catat pengeluaran dan pemasukan kamu hari ini yuk, biar keuangan tetap terkontrol! 💰"
      ).catch(console.error)
    );

    await Promise.all(promises);
    console.log(`Daily reminder sent to ${promises.length} users.`);
  }
);

// ══════════════════════════════════════════════════════════════
// 2. TRIGGER — saat transaksi baru ditulis ke RTDB
//    Path: users/{uid}/transactions/{txId}
// ══════════════════════════════════════════════════════════════
exports.onTransactionWrite = onValueWritten(
  {
    ref:    "users/{uid}/transactions/{txId}",
    region: "asia-southeast1",
  },
  async event => {
    const uid = event.params.uid;

    // Hitung total pemasukan & pengeluaran bulan ini
    const txsSnap = await db.ref(`users/${uid}/transactions`).get();
    if (!txsSnap.exists()) return;

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();
    const today = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalIncome = 0, totalExpense = 0;
    txsSnap.forEach(child => {
      const tx = child.val();
      const d  = new Date(tx.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      if (tx.type === "in")  totalIncome  += tx.amount;
      if (tx.type === "out") totalExpense += tx.amount;
    });

    if (totalIncome <= 0) return;

    const pct = Math.round((totalExpense / totalIncome) * 100);

    const thresholds = [
      {
        pct: 50,
        title: "💸 Setengah Budget Terpakai",
        body:  "Pengeluaran kamu bulan ini sudah mencapai 50% dari pemasukan kamu nih, jangan boros-boros ya!",
      },
      {
        pct: 90,
        title: "⚠️ Budget Hampir Habis!",
        body:  "Pengeluaran kamu bulan ini sudah mencapai 90% dari pemasukan kamu nih, jangan boros-boros ya!",
      },
      {
        pct: 100,
        title: "🚨 Budget Habis!",
        body:  "Pengeluaran kamu bulan ini sudah mencapai 100% dari pemasukan kamu ya, hati-hati defisit!",
      },
    ];

    for (const t of thresholds) {
      if (pct < t.pct) continue;

      // Cek apakah notif threshold ini sudah dikirim bulan ini
      const flagKey  = `${today}_${t.pct}`;
      const flagSnap = await db.ref(`users/${uid}/notif_sent/${flagKey}`).get();
      if (flagSnap.exists()) continue; // sudah dikirim, skip

      // Kirim notif
      await sendToUser(uid, t.title, t.body);

      // Tandai sudah dikirim
      await db.ref(`users/${uid}/notif_sent/${flagKey}`).set(true);

      console.log(`[${uid}] Threshold ${t.pct}% notif sent.`);
    }
  }
);
