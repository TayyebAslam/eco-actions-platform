"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/providers/push-notification-provider";
import { cn } from "@/lib/utils";

const DISMISS_TTL_DAYS = 30;

export function PushNotificationPrompt() {
  const { requestPermission } = usePushNotifications();
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "default"
    ) {
      return;
    }

    // Check if user previously dismissed with TTL
    const dismissedAt = localStorage.getItem("push_prompt_dismissed");
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000) return;
      localStorage.removeItem("push_prompt_dismissed");
    }

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    const success = await requestPermission();
    setLoading(false);

    if (success) {
      setShow(false);
    } else {
      setError(
        Notification.permission === "denied"
          ? "Notifications blocked. Please enable them in your browser settings."
          : "Could not enable notifications. Please try again."
      );
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("push_prompt_dismissed", Date.now().toString());
  };

  if (!show) return null;

  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm p-4 rounded-2xl shadow-2xl border",
        "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 shrink-0">
          <Bell className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
            Enable Push Notifications
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Get notified about activity approvals, challenges, and more — even
            when this tab is closed.
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 rounded-lg"
            >
              {loading ? "Enabling..." : "Enable"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-xs h-8 px-3 rounded-lg text-gray-500"
            >
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
