"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./auth-provider";
import { requestFCMToken, onForegroundMessage } from "@/lib/firebase";
import { pushTokensApi } from "@/lib/api";

interface PushNotificationContextType {
  requestPermission: () => Promise<boolean>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  requestPermission: async () => false,
});

export function PushNotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const tokenRegistered = useRef(false);
  const currentToken = useRef<string | null>(null);

  /**
   * Request notification permission and register the FCM token with the backend.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      return false;
    }

    // Check browser capabilities
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return false;
    }

    try {
      const token = await requestFCMToken();

      if (!token) {
        return false;
      }

      // Avoid re-registering the same token
      if (token === currentToken.current) return true;

      await pushTokensApi.register({
        token,
        device_type: "web",
        device_name: navigator.userAgent.substring(0, 255),
      });
      currentToken.current = token;
      tokenRegistered.current = true;
      return true;
    } catch (error) {
      console.error("[Push] Failed to register push token:", error);
      return false;
    }
  }, [isAuthenticated]);

  /**
   * Auto-register on login if permission was previously granted.
   */
  useEffect(() => {
    if (!isAuthenticated || tokenRegistered.current) return;

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      requestPermission();
    }
  }, [isAuthenticated, requestPermission]);

  /**
   * Handle foreground messages — suppress since Socket.io toasts handle these.
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    let unsubscribe: (() => void) | null = null;

    onForegroundMessage(() => {
      // Foreground messages are handled by Socket.io toasts — suppress FCM
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  /**
   * Unregister token on logout.
   */
  useEffect(() => {
    if (!isAuthenticated && currentToken.current) {
      const token = currentToken.current;
      pushTokensApi.unregister({ token }).catch(() => {
        // Best effort — token will become stale and be cleaned up
      });
      currentToken.current = null;
      tokenRegistered.current = false;
    }
  }, [isAuthenticated]);

  return (
    <PushNotificationContext.Provider value={{ requestPermission }}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  return useContext(PushNotificationContext);
}
