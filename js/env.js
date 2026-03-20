/**
 * env.js
 * Semua konfigurasi dibaca dari environment variables (di-inject oleh Vite).
 * Nilai fallback (??): dipakai saat dev lokal jika .env tidak ada.
 */

const ENV = {

  // ── Firebase ───────────────────────────────────────────────
  firebase: {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  },

  // ── App ────────────────────────────────────────────────────
  app: {
    name:           import.meta.env.VITE_APP_NAME           ?? "Dompet",
    currency:       import.meta.env.VITE_APP_CURRENCY        ?? "IDR",
    maxTransaction: Number(import.meta.env.VITE_APP_MAX_TRANSACTION ?? 100_000_000_000),
  },

  // ── Budget defaults (Rupiah) ───────────────────────────────
  budget: {
    makanan:      Number(import.meta.env.VITE_BUDGET_MAKANAN      ?? 700_000),
    transportasi: Number(import.meta.env.VITE_BUDGET_TRANSPORTASI ?? 700_000),
    investasi:    Number(import.meta.env.VITE_BUDGET_INVESTASI    ?? 10_478_536),
  },

  // ── Thresholds ─────────────────────────────────────────────
  threshold: {
    warnPct:        Number(import.meta.env.VITE_WARN_THRESHOLD_PCT  ?? 80),
    passwordMinLen: Number(import.meta.env.VITE_PASSWORD_MIN_LENGTH ?? 6),
    usernameMinLen: Number(import.meta.env.VITE_USERNAME_MIN_LENGTH ?? 3),
  },

  // ── Feature flags ──────────────────────────────────────────
  features: {
    autoRollover:  (import.meta.env.VITE_FEATURE_AUTO_ROLLOVER  ?? "true") === "true",
    deficitAlert:  (import.meta.env.VITE_FEATURE_DEFICIT_ALERT  ?? "true") === "true",
    budgetWarning: (import.meta.env.VITE_FEATURE_BUDGET_WARNING ?? "true") === "true",
    exportCsv:     (import.meta.env.VITE_FEATURE_EXPORT_CSV     ?? "true") === "true",
  },

};

export default ENV;