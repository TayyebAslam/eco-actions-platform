"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { usePermissions, ModuleKey } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
const SchoolsProgressChart = dynamic(
  () => import("@/components/charts/SchoolsProgressChart").then((mod) => ({ default: mod.SchoolsProgressChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
  }
);
const GrowthTrendsChart = dynamic(
  () => import("@/components/charts/GrowthTrendsChart").then((mod) => ({ default: mod.GrowthTrendsChart })),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
  }
);
import {
  Users,
  School,
  GraduationCap,
  BookOpen,
  Activity,
  Trophy,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Zap,
  Target,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface StatItem {
  name: string;
  key: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconBgDark: string;
  trend?: number;
  href: string;
  moduleKey?: ModuleKey;
  superAdminOnly?: boolean;
}

const stats: StatItem[] = [
  {
    name: "Total System Users",
    key: "totalSystemUsers",
    icon: Users,
    gradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-blue-500/10",
    iconBgDark: "bg-blue-500/20",
    trend: 12,
    href: "/dashboard/system-users",
    superAdminOnly: true,
  },
  {
    name: "Schools",
    key: "totalSchools",
    icon: School,
    gradient: "from-purple-500 to-violet-600",
    iconBg: "bg-purple-500/10",
    iconBgDark: "bg-purple-500/20",
    trend: 8,
    href: "/dashboard/schools",
    superAdminOnly: true,
  },
  {
    name: "Students",
    key: "totalStudents",
    icon: GraduationCap,
    gradient: "from-emerald-500 to-green-600",
    iconBg: "bg-emerald-500/10",
    iconBgDark: "bg-emerald-500/20",
    trend: 24,
    href: "/dashboard/students",
    moduleKey: "students",
  },
  {
    name: "Teachers",
    key: "totalTeachers",
    icon: BookOpen,
    gradient: "from-orange-500 to-amber-600",
    iconBg: "bg-orange-500/10",
    iconBgDark: "bg-orange-500/20",
    trend: 5,
    href: "/dashboard/teachers",
    moduleKey: "teachers",
  },
  {
    name: "Activities",
    key: "totalActivities",
    icon: Activity,
    gradient: "from-pink-500 to-rose-600",
    iconBg: "bg-pink-500/10",
    iconBgDark: "bg-pink-500/20",
    trend: 18,
    href: "/dashboard/activities",
    moduleKey: "activities",
  },
  {
    name: "Pending",
    key: "pendingActivities",
    icon: Clock,
    gradient: "from-amber-500 to-yellow-600",
    iconBg: "bg-amber-500/10",
    iconBgDark: "bg-amber-500/20",
    href: "/dashboard/activities",
    moduleKey: "activities",
  },
  {
    name: "Challenges",
    key: "totalChallenges",
    icon: Trophy,
    gradient: "from-cyan-500 to-teal-600",
    iconBg: "bg-cyan-500/10",
    iconBgDark: "bg-cyan-500/20",
    trend: 3,
    href: "/dashboard/challenges",
    moduleKey: "challenges",
  },
  {
    name: "Articles",
    key: "totalArticles",
    icon: FileText,
    gradient: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-500/10",
    iconBgDark: "bg-violet-500/20",
    href: "/dashboard/articles",
    moduleKey: "articles",
  },
];

// Quick actions with permission checks
const getQuickActions = (isSuperAdmin: boolean, canAccess: (key: ModuleKey) => boolean) => {
  const allActions = [
    {
      label: "Review Pending Activities",
      href: "/dashboard/activities",
      icon: Activity,
      color: "text-pink-600 dark:text-pink-400",
      bg: "bg-pink-50 dark:bg-pink-500/20",
      description: "Check and approve submitted activities",
      moduleKey: "activities" as ModuleKey,
    },
    {
      label: "Manage Schools",
      href: "/dashboard/schools",
      icon: School,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-500/20",
      description: "Add, edit or view school details",
      superAdminOnly: true,
    },
    {
      label: "View Students",
      href: "/dashboard/students",
      icon: GraduationCap,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-500/20",
      description: "Browse student profiles and progress",
      moduleKey: "students" as ModuleKey,
    },
    {
      label: "Create Challenge",
      href: "/dashboard/challenges",
      icon: Trophy,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-500/20",
      description: "Launch new eco-challenges for students",
      moduleKey: "challenges" as ModuleKey,
    },
  ];

  return allActions.filter((action) => {
    if (action.superAdminOnly) return isSuperAdmin;
    if (action.moduleKey) return isSuperAdmin || canAccess(action.moduleKey);
    return true;
  });
};

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(value * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

export function DashboardView() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isSuperAdmin, canAccess } = usePermissions();
  const isDark = theme === "dark";
  const quickActions = getQuickActions(isSuperAdmin, canAccess);

  // Filter stats based on permissions
  const filteredStats = stats.filter((stat) => {
    if (stat.superAdminOnly) return isSuperAdmin;
    if (stat.moduleKey) return isSuperAdmin || canAccess(stat.moduleKey);
    return true;
  });

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      try {
        const response = await dashboardApi.getStats();
        return response.data.data;
      } catch {
        return {
          totalSystemUsers: 0,
          totalSchools: 0,
          totalStudents: 0,
          totalTeachers: 0,
          totalActivities: 0,
          pendingActivities: 0,
          totalChallenges: 0,
          totalArticles: 0,
        };
      }
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const firstName = user?.first_name || "Admin";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-6 md:p-8 text-white">
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-emerald-200" />
              <span className="text-emerald-200 text-sm font-medium">{getGreeting()}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {firstName}! 👋
            </h1>
            <p className="text-white/80 max-w-lg">
              Here&apos;s what&apos;s happening with your sustainability ecosystem today. Let&apos;s make a positive impact together!
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-white/70">Daily Goal</p>
                <p className="text-lg font-bold">85%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid with Quick Actions on right */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Overview Stats - Left Side */}
        <div className={cn(
          quickActions.length > 0 ? "xl:col-span-9" : "xl:col-span-12"
        )}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>Overview</h2>
            <div className={cn(
              "flex items-center gap-2 text-sm",
              isDark ? "text-gray-400" : "text-gray-500"
            )}>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Updated just now</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredStats.map((stat, index) => (
              <Link
                key={stat.key}
                href={stat.href}
                className="block group"
              >
                <Card
                  className={cn(
                    "relative overflow-hidden border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
                    isDark
                      ? "bg-slate-800/50 backdrop-blur-sm shadow-slate-900/50"
                      : "bg-white shadow-gray-200/50"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className={cn(
                      "text-sm font-medium",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}>
                      {stat.name}
                    </CardTitle>
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-xl transition-transform group-hover:scale-110",
                      isDark ? stat.iconBgDark : stat.iconBg
                    )}>
                      <stat.icon className="h-5 w-5"
                        style={{ color: stat.gradient.includes('blue') ? '#3b82f6' : stat.gradient.includes('purple') ? '#a855f7' : stat.gradient.includes('emerald') ? '#10b981' : stat.gradient.includes('orange') ? '#f97316' : stat.gradient.includes('pink') ? '#ec4899' : stat.gradient.includes('amber') ? '#f59e0b' : stat.gradient.includes('cyan') ? '#06b6d4' : '#8b5cf6' }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <Skeleton className={cn("h-9 w-24", isDark ? "bg-slate-700" : "")} />
                    ) : (
                      <div className="flex items-end justify-between">
                        <div className={cn("text-3xl font-bold", isDark ? "text-white" : "text-gray-900")}>
                          <AnimatedCounter value={statsData?.[stat.key as keyof typeof statsData] ?? 0} />
                        </div>
                        {stat.trend && (
                          <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-1 rounded-full">
                            <ArrowUpRight className="h-3 w-3" />
                            {stat.trend}%
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions - Right Side */}
        {quickActions.length > 0 && (
          <div className="xl:col-span-3">
            <Card className={cn(
              "border-0 shadow-lg overflow-hidden h-full",
              isDark
                ? "bg-slate-800/50 backdrop-blur-sm shadow-slate-900/50"
                : "bg-white shadow-gray-200/50"
            )}>
              <CardHeader className={cn(
                "border-b",
                isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-100 bg-gray-50/50"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={cn("text-lg", isDark ? "text-white" : "")}>
                      Quick Actions
                    </CardTitle>
                    <CardDescription className={isDark ? "text-gray-400" : ""}>
                      Common tasks
                    </CardDescription>
                  </div>
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {quickActions.map((action, index) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200",
                        isDark
                          ? "border-slate-700 hover:border-slate-600 hover:bg-slate-700/50"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                      )}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg transition-transform group-hover:scale-110",
                        action.bg
                      )}>
                        <action.icon className={cn("h-5 w-5", action.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors",
                          isDark ? "text-white" : "text-gray-900"
                        )}>
                          {action.label}
                        </p>
                      </div>
                      <ArrowRight className={cn(
                        "h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200",
                        isDark ? "text-gray-500" : "text-gray-400"
                      )} />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Charts Section - Super Admin Only */}
      {isSuperAdmin && (
        <div className="space-y-6">
          <h2 className={cn(
            "text-lg font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}>Analytics & Insights</h2>

          {/* Growth Trends */}
          <GrowthTrendsChart />

          {/* Schools Progress */}
          <SchoolsProgressChart />
        </div>
      )}

    </div>
  );
}

