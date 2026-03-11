"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions, ModuleKey } from "@/hooks/usePermissions";
import { AlertCircle, Loader2 } from "lucide-react";

interface PermissionGuardProps {
  moduleKey: ModuleKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Module key to display name mapping
const moduleDisplayNames: Record<ModuleKey, string> = {
  students: "Students",
  teachers: "Teachers",
  categories: "Categories",
  activities: "Activities",
  challenges: "Challenges",
  articles: "Articles",
  badges: "Badges",
  levels: "Levels",
  schools: "Schools",
  school_requests: "School Requests",
  super_sub_admins: "System Users",
  platform_reports: "Platform Reports",
  admins: "School Admins",
};

/**
 * A guard component that protects routes based on user permissions.
 * Shows error banner for 2 seconds, then redirects back.
 */
export function PermissionGuard({ moduleKey, children, fallback }: PermissionGuardProps) {
  const router = useRouter();
  const { isLoading } = useAuth();
  const { isSuperAdmin, canAccess } = usePermissions();
  const hasRedirected = useRef(false);
  const [showError, setShowError] = useState(false);

  const hasAccess = isSuperAdmin || canAccess(moduleKey);
  const moduleName = moduleDisplayNames[moduleKey] || moduleKey;

  useEffect(() => {
    // Wait for auth to finish loading before checking permissions
    if (isLoading) return undefined;

    if (!hasAccess && !hasRedirected.current) {
      setShowError(true);
      hasRedirected.current = true;

      // Wait 2 seconds, then redirect
      const timer = setTimeout(() => {
        // Check if there's browser history to go back to
        if (typeof window !== "undefined" && window.history.length > 2) {
          router.back();
        } else {
          // Fallback to dashboard
          router.push("/dashboard");
        }
      }, 2000);

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [hasAccess, isLoading, router]);

  // Show loading while auth is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If no access, show error banner then redirect
  if (!hasAccess) {
    return (
      fallback || (
        <div className="space-y-4">
          {showError && (
            <div className="bg-destructive text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    You are not authorized to access {moduleName}.
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    Redirecting back...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    );
  }

  return <>{children}</>;
}
