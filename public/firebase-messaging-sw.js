// public/firebase-messaging-sw.js
// Config di-inject otomatis oleh Vite saat build (vite.config.js)
// Placeholder __VITE_*__ diganti dengan nilai dari .env

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "__VITE_FIREBASE_API_KEY__",
  authDomain:        "__VITE_FIREBASE_AUTH_DOMAIN__",
  databaseURL:       "__VITE_FIREBASE_DATABASE_URL__",
  projectId:         "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket:     "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId:             "__VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Dompet", {
    body:    body ?? "",
    icon:    icon ?? "/icon-192.png",
    badge:   "/icon-192.png",
    vibrate: [200, 100, 200],
    data:    payload.data ?? {},
  });
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});