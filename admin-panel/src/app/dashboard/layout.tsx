"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PermissionErrorBanner } from "@/components/ui/permission-error-banner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile sidebar
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true); // Desktop sidebar
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme === "dark";

  useEffect(() => {
    // Don't redirect if still loading
    if (isLoading) return;

    // Check user data in localStorage to avoid race conditions after login
    // (tokens are now in httpOnly cookies, not accessible via JS)
    const hasUser = typeof window !== 'undefined' && localStorage.getItem("user");

    if (!isAuthenticated && !hasUser) {
      router.push("/auth/login");
      return;
    }

    // Check if admin user has a school assigned
    // If admin without school_id, redirect to school setup
    if (isAuthenticated && user) {
      if (user.role === "admin" && !user.school_id) {
        router.push("/auth/school-setup");
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center",
        isDark ? "bg-slate-950" : "bg-gray-50"
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Don't render dashboard for admins without school
  if (user?.role === "admin" && !user?.school_id) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center",
        isDark ? "bg-slate-950" : "bg-gray-50"
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className={cn(
            "text-sm",
            isDark ? "text-gray-400" : "text-gray-500"
          )}>Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex h-screen overflow-hidden transition-colors duration-300",
      isDark ? "bg-slate-950" : "bg-gray-50"
    )}>
      {/* Background pattern for light mode */}
      {!isDark && (
        <div className="fixed inset-0 -z-10 gradient-mesh opacity-50" />
      )}

      {/* Decorative orbs for dark mode */}
      {isDark && (
        <>
          <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="fixed bottom-0 left-1/3 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl translate-y-1/2 pointer-events-none" />
        </>
      )}

      <Sidebar
        open={sidebarOpen}
        desktopOpen={desktopSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 transition-[margin] duration-300 ease-out",
          desktopSidebarOpen ? "lg:ml-72" : "lg:ml-0"
        )}
      >
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          sidebarOpen={desktopSidebarOpen}
          onSidebarToggle={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
        />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden">
          <PermissionErrorBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
