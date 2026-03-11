"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UserCog,
  School,
  GraduationCap,
  BookOpen,
  Folder,
  Activity,
  Trophy,
  FileText,
  Award,
  TrendingUp,
  Leaf,
  X,
  ClipboardCheck,
  Sun,
  Moon,
  ChevronDown,
  UsersRound,
  Building2,
  Blocks,
  Gamepad2,
  Settings,
  ShieldCheck,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions, ModuleKey } from "@/hooks/usePermissions";
import { useTheme } from "@/providers/theme-provider";
import { Monitor } from "lucide-react";
import { usePermissionUpdates } from "@/hooks/usePermissionUpdates";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  moduleKey?: ModuleKey;
  superAdminOnly?: boolean;
  adminAndAbove?: boolean;
}

interface NavGroup {
  name: string;
  icon: React.ElementType;
  items: NavItem[];
}

// Standalone items (no dropdown)
const standaloneItems: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "System Users", href: "/dashboard/system-users", icon: UserCog, superAdminOnly: true },
  { name: "School Requests", href: "/dashboard/school-requests", icon: ClipboardCheck, superAdminOnly: true },
  { name: "Schools", href: "/dashboard/schools", icon: School, superAdminOnly: true },
  { name: "School Admins", href: "/dashboard/admins", icon: UsersRound, moduleKey: "admins" },
  { name: "Students", href: "/dashboard/students", icon: GraduationCap, moduleKey: "students" },
  { name: "Teachers", href: "/dashboard/teachers", icon: BookOpen, moduleKey: "teachers" },
  { name: "Audit Logs", href: "/dashboard/audit-logs", icon: History, adminAndAbove: true },
];

// Grouped navigation with dropdowns
const navGroups: NavGroup[] = [
  {
    name: "Content",
    icon: Blocks,
    items: [
      { name: "Activities", href: "/dashboard/activities", icon: Activity, moduleKey: "activities" },
      { name: "Articles", href: "/dashboard/articles", icon: FileText, moduleKey: "articles" },
    ],
  },
  {
    name: "Gamification",
    icon: Gamepad2,
    items: [
      { name: "Challenges", href: "/dashboard/challenges", icon: Trophy, moduleKey: "challenges" },
    ],
  },
  {
    name: "Settings",
    icon: Settings,
    items: [
      { name: "Job Title", href: "/dashboard/roles", icon: ShieldCheck, superAdminOnly: true },
      { name: "Categories", href: "/dashboard/categories", icon: Folder, moduleKey: "categories" },
      { name: "Badges", href: "/dashboard/badges", icon: Award, moduleKey: "badges" },
      { name: "Levels", href: "/dashboard/levels", icon: TrendingUp, moduleKey: "levels" },
    ],
  },
];

interface SidebarProps {
  open?: boolean;
  desktopOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, desktopOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isSuperAdmin, isAdmin, canAccess } = usePermissions();
  const { mode, theme, setMode } = useTheme();
  const isDark = theme === "dark";
  const isCollapsedAndHidden = !desktopOpen && !open;

  // Listen for real-time permission updates
  usePermissionUpdates();

  // Track clicked item for instant feedback
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => pathname.startsWith(item.href))
    );
    return activeGroup ? [activeGroup.name] : [];
  });

  // Clear pending state when navigation completes
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const handleNavClick = (href: string) => {
    setPendingHref(href);
    onClose?.();
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupName)
        ? prev.filter((name) => name !== groupName)
        : [...prev, groupName]
    );
  };

  // Filter items based on permissions and adjust labels by role
  const filterItems = (items: NavItem[]) => {
    return items
      .filter((item) => {
        if (item.superAdminOnly) {
          return isSuperAdmin;
        }
        if (item.adminAndAbove) {
          return isSuperAdmin || isAdmin;
        }
        if (item.moduleKey) {
          return isSuperAdmin || canAccess(item.moduleKey);
        }
        return true;
      })
      .map((item) => {
        // Admin sees "System Users" instead of "School Admins"
        if (item.moduleKey === "admins" && !isSuperAdmin) {
          return { ...item, name: "System Users" };
        }
        return item;
      });
  };

  // Check if any item in group is active (including pending)
  const isGroupActive = (group: NavGroup) => {
    return group.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href) || pendingHref === item.href
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-hidden={isCollapsedAndHidden}
        inert={isCollapsedAndHidden}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col transition-transform duration-300 ease-out will-change-transform",
          isDark
            ? "bg-slate-900/95 border-r border-slate-800"
            : "bg-white/95 border-r border-gray-100",
          "backdrop-blur-xl lg:backdrop-blur-none shadow-xl",
          open ? "translate-x-0" : "-translate-x-full",
          desktopOpen ? "lg:translate-x-0" : "lg:-translate-x-full lg:pointer-events-none"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex h-16 items-center justify-between px-5 border-b",
          isDark ? "border-slate-800" : "border-gray-100"
        )}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-shadow duration-300">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-lg font-bold tracking-tight",
                isDark ? "text-white" : "text-gray-900"
              )}>Thrive</span>
              <span className={cn(
                "text-[10px] font-medium -mt-1",
                isDark ? "text-emerald-400" : "text-emerald-600"
              )}>Admin Panel</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "lg:hidden rounded-xl",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-slate-800"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto p-4 scrollbar-thin",
          isDark && "scrollbar-dark"
        )}>
          <div className={cn(
            "text-[11px] font-semibold uppercase tracking-wider mb-3 px-3",
            isDark ? "text-slate-500" : "text-gray-400"
          )}>
            Menu
          </div>

          <ul className="space-y-1">
            {/* Standalone Items (Dashboard, Users, Students, Teachers) */}
            {filterItems(standaloneItems).map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) || pendingHref === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25"
                        : isDark
                          ? "text-slate-400 hover:text-white hover:bg-slate-800/70"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-white/20 text-white"
                        : isDark
                          ? "bg-slate-800 text-slate-400"
                          : "bg-gray-100 text-gray-500"
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    {item.name}
                  </Link>
                </li>
              );
            })}

            {/* Grouped Navigation with Dropdowns */}
            {navGroups.map((group) => {
              const filteredItems = filterItems(group.items);

              // Don't render group if no items are accessible
              if (filteredItems.length === 0) return null;

              const isExpanded = expandedGroups.includes(group.name);
              const groupActive = isGroupActive(group);

              return (
                <li key={group.name} className="mt-2">
                  {/* Group Header (Clickable) */}
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      groupActive && !isExpanded
                        ? "bg-gradient-to-r from-emerald-500/10 to-green-600/10 text-emerald-600 dark:text-emerald-400"
                        : isDark
                          ? "text-slate-400 hover:text-white hover:bg-slate-800/70"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                        groupActive
                          ? isDark
                            ? "bg-emerald-500/20 text-emerald-500"
                            : "bg-emerald-100 text-emerald-500"
                          : isDark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-gray-100 text-gray-500"
                      )}>
                        <group.icon className="h-4 w-4" />
                      </div>
                      {group.name}
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-all duration-200",
                        isExpanded ? "rotate-180" : "",
                        groupActive
                          ? "text-emerald-500"
                          : isDark
                            ? "text-slate-500"
                            : "text-gray-400"
                      )}
                    />
                  </button>

                  {/* Group Items (Collapsible) */}
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200",
                      isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <ul className="mt-1 ml-4 space-y-1 border-l-2 border-slate-700/30 dark:border-slate-700 pl-3">
                      {filteredItems.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
                          pendingHref === item.href;

                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              onClick={() => handleNavClick(item.href)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                                isActive
                                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/20"
                                  : isDark
                                    ? "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/60"
                              )}
                            >
                              <item.icon className="h-4 w-4" />
                              {item.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer with Theme Selector */}
        <div className={cn(
          "border-t",
          isDark ? "border-slate-800" : "border-gray-100"
        )}>
          {/* Theme Selector */}
          <div className={cn(
            "p-4 m-2 rounded-xl items-center justify-center flex",
            isDark ? "bg-slate-800/50" : "bg-gray-50"
          )}>
            <div className="flex gap-1">
              {/* Light Mode */}
              <button
                onClick={() => setMode("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200",
                  mode === "light"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>

              {/* Dark Mode */}
              <button
                onClick={() => setMode("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200",
                  mode === "dark"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                )}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>

              {/* System Mode */}
              <button
                onClick={() => setMode("system")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200",
                  mode === "system"
                    ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                    : isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                System
              </button>
            </div>
          </div>

          {/* Version */}
          <p className={cn(
            "text-[10px] text-center font-medium",
            isDark ? "text-slate-600" : "text-gray-400"
          )}>
            Thrive Admin v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
