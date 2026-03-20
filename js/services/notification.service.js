/**
 * js/services/notification.service.js
 * ─────────────────────────────────────────────────────────────
 * - Minta izin notifikasi ke user
 * - Ambil FCM token
 * - Simpan token ke Firebase RTDB (/users/{uid}/fcm_tokens/{token})
 * - Cek & kirim notif threshold (50% / 90% / 100%)
 * ─────────────────────────────────────────────────────────────
 */

import ENV from "../env.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { db, fbRef } from "./firebase.service.js";
import { get, set, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let _messaging = null;

// ── Init messaging ─────────────────────────────────────────────
export function initMessaging(firebaseApp) {
  try {
    _messaging = getMessaging(firebaseApp);
  } catch (e) {
    console.warn("FCM tidak tersedia:", e);
  }
}

// ── Minta izin & daftarkan token ───────────────────────────────
export async function requestNotifPermission(uid) {
  if (!_messaging) return null;
  if (!("Notification" in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notifikasi ditolak user.");
      return null;
    }

    // Daftarkan service worker
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // Ambil FCM token
    const token = await getToken(_messaging, {
      vapidKey:           ENV.firebase.vapidKey,
      serviceWorkerRegistration: swReg,
    });
    console.log("FCM TOKEN:", token); // ← tambah ini sementara


    if (!token) return null;

    // Simpan token ke Firebase
    await _saveToken(uid, token);

    // Handle notif saat app foreground
    onMessage(_messaging, payload => {
      _showForegroundNotif(payload);
    });

    return token;
  } catch (e) {
    console.error("Gagal daftar FCM:", e);
    return null;
  }
}

// ── Simpan token ke RTDB ───────────────────────────────────────
async function _saveToken(uid, token) {
  // Simpan token dengan timestamp — satu user bisa punya banyak device
  await set(ref(db, `users/${uid}/fcm_tokens/${_sanitizeKey(token)}`), {
    token,
    updated_at: new Date().toISOString(),
    platform:   navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
  });
}

// FCM token mengandung karakter : yang tidak valid sebagai Firebase key
function _sanitizeKey(token) {
  return token.replace(/[.#$[\]]/g, "_").slice(0, 100);
}

// ── Notif foreground (app sedang dibuka) ───────────────────────
function _showForegroundNotif(payload) {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  // Pakai native Notification API kalau permission sudah granted
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/icon-192.png",
    });
  }
}

// ── Cek threshold & kirim notif lokal (anti-spam: sekali per hari) ──
const THRESHOLD_KEYS = {
  50:  "notif_threshold_50",
  90:  "notif_threshold_90",
  100: "notif_threshold_100",
};

export function checkAndNotifyThreshold(uid, totalIncome, totalExpense) {
  if (!totalIncome || totalIncome <= 0) return;

  const pct = Math.round((totalExpense / totalIncome) * 100);
  const today = new Date().toISOString().slice(0, 7); // "YYYY-MM" — reset tiap bulan

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

    const storageKey = `${THRESHOLD_KEYS[t.pct]}_${uid}_${today}`;
    const alreadySent = localStorage.getItem(storageKey);
    if (alreadySent) continue; // sudah dikirim bulan ini

    // Tandai sudah dikirim
    localStorage.setItem(storageKey, "1");

    // Kirim notif lokal (foreground)
    if (Notification.permission === "granted") {
      new Notification(t.title, {
        body: t.body,
        icon: "/icon-192.png",
      });
    }

    // Juga simpan flag ke Firebase supaya Cloud Function tidak kirim duplikat
    if (uid) {
      set(ref(db, `users/${uid}/notif_sent/${today}_${t.pct}`), true).catch(console.warn);
    }
    
  }
  
}
