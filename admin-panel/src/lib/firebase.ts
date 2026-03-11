import { initializeApp, getApps } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  Messaging,
  MessagePayload,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only in browser, only once)
const app =
  typeof window !== "undefined" && getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0] || null;

/**
 * Get Firebase Messaging instance (only if supported by the browser).
 */
export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported || !app) return null;
  return getMessaging(app);
};

/**
 * Request notification permission and get FCM token.
 * 1. Register service worker and wait for activation
 * 2. Request permission
 * 3. Call getToken with vapidKey + explicit serviceWorkerRegistration
 */
export const requestFCMToken = async (): Promise<string | null> => {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    // Register service worker and wait for it to be ready
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    // Wait for the service worker to be fully active (with timeout)
    if (registration.installing || registration.waiting) {
      const sw = registration.installing || registration.waiting;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Service worker activation timed out"));
        }, 10000);

        sw!.addEventListener("statechange", function handler() {
          if (this.state === "activated") {
            clearTimeout(timeout);
            this.removeEventListener("statechange", handler);
            resolve();
          } else if (this.state === "redundant") {
            clearTimeout(timeout);
            this.removeEventListener("statechange", handler);
            reject(new Error("Service worker became redundant"));
          }
        });
        if (sw!.state === "activated") {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

/**
 * Listen for foreground messages.
 * Returns an unsubscribe function.
 */
export const onForegroundMessage = async (
  callback: (payload: MessagePayload) => void
): Promise<(() => void) | null> => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;
  return onMessage(messaging, callback);
};
