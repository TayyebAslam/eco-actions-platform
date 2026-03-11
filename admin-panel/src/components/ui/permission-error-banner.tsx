"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PERMISSION_ERROR_KEY = "permission_error_message";

/**
 * Store permission error message in sessionStorage
 */
export function setPermissionError(message: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PERMISSION_ERROR_KEY, message);
  }
}

/**
 * Get and clear permission error message from sessionStorage
 */
export function getPermissionError(): string | null {
  if (typeof window !== "undefined") {
    const message = sessionStorage.getItem(PERMISSION_ERROR_KEY);
    sessionStorage.removeItem(PERMISSION_ERROR_KEY);
    return message;
  }
  return null;
}

/**
 * Permission Error Banner Component
 * Shows error message at the top of the content area and auto-hides after 3 seconds
 */
export function PermissionErrorBanner() {
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const message = getPermissionError();
    if (message) {
      setError(message);
      setIsVisible(true);

      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setError(null), 300); // Wait for animation
      }, 3000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setError(null), 300);
  };

  if (!error) return null;

  return (
    <div
      className={cn(
        "mb-4 transition-all duration-300 ease-in-out overflow-hidden",
        isVisible ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
      )}
    >
      <div className="bg-destructive text-white px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-destructive/80 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
