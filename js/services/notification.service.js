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

    // Daftarkan service worker dan tunggu sampai aktif
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    // Tunggu SW benar-benar aktif sebelum minta token
    await new Promise(resolve => {
      if (swReg.active) { resolve(); return; }
      const sw = swReg.installing ?? swReg.waiting;
      if (sw) {
        sw.addEventListener("statechange", e => {
          if (e.target.state === "activated") resolve();
        });
      } else {
        // SW sudah ada sebelumnya, langsung resolve
        navigator.serviceWorker.ready.then(() => resolve());
      }
    });

    // Ambil FCM token — selalu refresh supaya tidak expired setelah reinstall PWA
    const token = await getToken(_messaging, {
      vapidKey:                  ENV.firebase.vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return null;

    // Simpan token ke Firebase (selalu update supaya token tidak expired)
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
  const key      = _sanitizeKey(token);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const platform = isMobile ? "mobile" : "desktop";

  // Selalu update token setiap login supaya tidak expired
  await set(ref(db, `users/${uid}/fcm_tokens/${key}`), {
    token,
    updated_at: new Date().toISOString(),
    platform,
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

export async function checkAndNotifyThreshold(uid, totalIncome, totalExpense) {
  // Kalau tidak ada pemasukan sama sekali, skip
  if (totalExpense <= 0) return;
  // Kalau income 0 tapi ada pengeluaran, anggap 100%
  const income = totalIncome > 0 ? totalIncome : 0;

  try {
    const res = await fetch("/api/notify-threshold", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ uid, totalIncome: income, totalExpense }),
    });
    const data = await res.json();
    console.log("[Threshold API]", data);
  } catch (e) {
    console.warn("Gagal kirim threshold notif:", e);
  }
}

// ── Notif konfirmasi setelah catat transaksi ───────────────────
// Kirim via Vercel API supaya push ke semua device user
export async function notifyTransactionSaved(uid, tx) {
  try {
    await fetch("/api/notify-transaction", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ uid, tx }),
    });
  } catch (e) {
    console.warn("Gagal kirim notif transaksi:", e);
  }
}