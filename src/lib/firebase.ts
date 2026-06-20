// Firebase Web client initialization + Cloud Messaging helpers.
// Public Firebase config values are safe to ship in the client bundle.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from "firebase/messaging";

export const firebaseConfig = {
  apiKey: "AIzaSyCXPvWU6FEHXL4lWYAQl1fG_kJ6w1tI2GQ",
  authDomain: "app-declic-pizza.firebaseapp.com",
  projectId: "app-declic-pizza",
  storageBucket: "app-declic-pizza.firebasestorage.app",
  messagingSenderId: "42244551478",
  appId: "1:42244551478:web:4a496ad177fee2f1ae7997",
  measurementId: "G-Y5CWYEV4D0",
};

// VAPID public key (Web Push certificate) from the Firebase console.
export const VAPID_KEY = "BE8rDxpcd5vCFPRh4KyIfzDH6MqhcMyZQvcGBgICQEytzdmighZ3Gm5SToOGYEKkqH3QSMP-mRiTkiPD6s8o-XU";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  if (!app) app = initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

export { getToken, onMessage };
