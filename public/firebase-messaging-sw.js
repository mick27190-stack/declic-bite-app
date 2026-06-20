/* Firebase Cloud Messaging service worker.
   This file MUST live at the site root (/firebase-messaging-sw.js) and is
   loaded by the browser, not bundled by Vite — so we use the compat SDK
   via importScripts and inline the (public) Firebase config. */

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyCXPvWU6FEHXL4lWYAQl1fG_kJ6w1tI2GQ",
  authDomain: "app-declic-pizza.firebaseapp.com",
  projectId: "app-declic-pizza",
  storageBucket: "app-declic-pizza.firebasestorage.app",
  messagingSenderId: "42244551478",
  appId: "1:42244551478:web:4a496ad177fee2f1ae7997",
  measurementId: "G-Y5CWYEV4D0",
});

const messaging = firebase.messaging();

// Background messages: show a system notification (the OS plays the sound).
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Déclic Pizza";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.data?.reference_id || undefined,
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      })
  );
});
