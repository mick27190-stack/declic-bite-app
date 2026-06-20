// Web Push (FCM) registration: requests permission, registers the service
// worker, fetches the FCM token and stores it in the push_tokens table.

import { supabase } from "@/integrations/supabase/client";
import {
  getFirebaseMessaging,
  getToken,
  onMessage,
  VAPID_KEY,
} from "@/lib/firebase";

let foregroundUnsub: (() => void) | null = null;

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    console.error("[push] SW registration failed:", e);
    return null;
  }
}

/**
 * Sets up Web Push for the signed-in user. Safe to call multiple times.
 * Returns the FCM token when successful, otherwise null.
 */
export async function setupPushNotifications(
  site?: string
): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return null;
    }

    if (!VAPID_KEY || VAPID_KEY.startsWith("REPLACE_WITH")) {
      console.warn("[push] VAPID key not configured yet.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const registration = await registerServiceWorker();
    if (!registration) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    // Persist the token for the current user.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("push_tokens").upsert(
        {
          user_id: user.id,
          token,
          site: site ?? null,
          user_agent: navigator.userAgent,
        },
        { onConflict: "user_id,token" }
      );
    }

    // Foreground messages: still surface a notification while the app is open.
    if (foregroundUnsub) foregroundUnsub();
    foregroundUnsub = onMessage(messaging, (payload) => {
      const title =
        payload.notification?.title || payload.data?.title || "Déclic Pizza";
      const body = payload.notification?.body || payload.data?.body || "";
      try {
        new Notification(title, { body, icon: "/favicon.ico" });
      } catch {
        // ignore — foreground sound is handled elsewhere
      }
    });

    return token;
  } catch (e) {
    console.error("[push] setup failed:", e);
    return null;
  }
}
