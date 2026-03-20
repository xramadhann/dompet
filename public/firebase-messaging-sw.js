// public/firebase-messaging-sw.js
// Service Worker untuk FCM — config harus hardcode karena SW
// tidak bisa akses import.meta.env (di luar Vite bundle)

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyDo3jwhd4Nz339HDdZdo32ArWWjUHh-Q4M",
  authDomain:        "dompet-64e72.firebaseapp.com",
  databaseURL:       "https://dompet-64e72-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "dompet-64e72",
  storageBucket:     "dompet-64e72.firebasestorage.app",
  messagingSenderId: "272498971576",
  appId:             "1:272498971576:web:620874bd0989002ce5354d",
});

const messaging = firebase.messaging();

// Handle notif saat app di background / browser tutup
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

// Klik notif → buka / fokus tab app
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