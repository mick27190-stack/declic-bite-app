// Browser (Web Notifications API) helpers for showing system push notifications
// while the app is open in a browser tab.

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function showWebNotification(title: string, body: string, tag?: string) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: '/icon-192.png?v=1ccba9db',
      badge: '/icon-192.png?v=1ccba9db',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Some browsers (e.g. mobile) require a ServiceWorkerRegistration; ignore failures.
  }
}
