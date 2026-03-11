import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAssetUrl(path?: string) {
  if (!path) return "";
  const trimmed = path.trim();
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  const isData = trimmed.startsWith("data:");
  const isBlob = trimmed.startsWith("blob:");
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  // Build origins to strip dynamically from env variable
  const originsToStrip: string[] = [];
  if (baseUrl) {
    const normalizedBase = baseUrl.replace(/\/+$/, "");
    originsToStrip.push(normalizedBase);
    // Also add localhost variants if running locally
    if (
      normalizedBase.includes("localhost") ||
      normalizedBase.includes("127.0.0.1")
    ) {
      const port = normalizedBase.match(/:(\d+)/)?.[1] || "5000";
      originsToStrip.push(
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
        `https://localhost:${port}`,
        `https://127.0.0.1:${port}`,
      );
    }
  }

  if (isAbsolute && !isData) {
    for (const origin of originsToStrip) {
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (
        trimmed === normalizedOrigin ||
        trimmed.startsWith(normalizedOrigin + "/")
      ) {
        const relative = trimmed.slice(normalizedOrigin.length);
        return relative.startsWith("/") ? relative : `/${relative}`;
      }
    }
    return trimmed;
  }

  if (isData || isBlob) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

export function validatePassword(password: string): { isValid: boolean; error: string } | { isValid: true; error?: never } {
  if (!password) {
    return { isValid: false, error: "Password is required" };
  }

  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters" };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one lowercase letter" };
  }

  if (!/\d/.test(password)) {
    return { isValid: false, error: "Password must contain at least one number" };
  }

  if (!/[@$!%*?&#]/.test(password)) {
    return { isValid: false, error: "Password must contain at least one special character (@$!%*?&#)" };
  }

  return { isValid: true };
}

export const isValidUrl = (url?: string) => {
  if (!url) return false;

  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    new URL(url, base);
    return true;
  } catch {
    return false;
  }
};
