"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useTheme } from "@/providers/theme-provider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  School,
  GraduationCap,
  Activity,
  BookOpen,
} from "lucide-react";

interface TrendData {
  month: string;
  year: number;
  count: number;
}

interface GrowthTrendsData {
  schools: {
    trend: TrendData[];
    totalThisMonth: number;
    growthPercent: number;
  };
  students: {
    trend: TrendData[];
    totalThisMonth: number;
    growthPercent: number;
  };
  activities: {
    trend: TrendData[];
    totalThisMonth: number;
  };
  teachers: {
    trend: TrendData[];
    totalThisMonth: number;
  };
}

export const GrowthTrendsChart = React.memo(function GrowthTrendsChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: trendsData, isLoading } = useQuery({
    queryKey: ["growth-trends"],
    queryFn: async () => {
      try {
        const response = await dashboardApi.getGrowthTrends(6);
        return response.data.data as GrowthTrendsData;
      } catch {
        return null;
      }
    },
  });

  if (isLoading) {
    return (
      <Card
        className={cn(
          "border-0 shadow-lg",
          isDark
            ? "bg-slate-800/50 backdrop-blur-sm shadow-slate-900/50"
            : "bg-white shadow-gray-200/50"
        )}
      >
        <CardHeader>
          <Skeleton className={cn("h-6 w-48", isDark ? "bg-slate-700" : "")} />
          <Skeleton className={cn("h-4 w-64", isDark ? "bg-slate-700" : "")} />
        </CardHeader>
        <CardContent>
          <Skeleton className={cn("h-80 w-full", isDark ? "bg-slate-700" : "")} />
        </CardContent>
      </Card>
    );
  }

  if (!trendsData) {
    return (
      <Card
        className={cn(
          "border-0 shadow-lg",
          isDark
            ? "bg-slate-800/50 backdrop-blur-sm shadow-slate-900/50"
            : "bg-white shadow-gray-200/50"
        )}
      >
        <CardHeader>
          <CardTitle className={isDark ? "text-white" : ""}>
            Growth Trends
          </CardTitle>
          <CardDescription className={isDark ? "text-gray-400" : ""}>
            No data available
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const combinedData = trendsData.schools.trend.map((item, index) => ({
    name: `${item.month} ${item.year}`,
    Schools: item.count,
    Students: trendsData.students.trend[index]?.count || 0,
    Activities: trendsData.activities.trend[index]?.count || 0,
    Teachers: trendsData.teachers.trend[index]?.count || 0,
  }));

  const axisStyle = {
    fontSize: 12,
    fill: isDark ? "#9ca3af" : "#6b7280",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="rounded-lg border p-3 shadow-lg"
          style={{
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            borderColor: isDark ? "#334155" : "#e5e7eb",
          }}
        >
          <p
            className={cn(
              "font-medium mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const StatCard = ({
    title,
    value,
    growth,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    growth?: number;
    icon: any;
    color: string;
  }) => (
    <div
      className={cn(
        "p-4 rounded-xl",
        isDark ? "bg-slate-700/50" : "bg-gray-50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div
          className={cn(
            "p-2 rounded-lg",
            isDark ? "bg-slate-600" : "bg-white"
          )}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {growth !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              growth >= 0
                ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "text-destructive bg-destructive/10"
            )}
          >
            {growth >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(growth)}%
          </div>
        )}
      </div>
      <p
        className={cn(
          "text-2xl font-bold",
          isDark ? "text-white" : "text-gray-900"
        )}
      >
        {value.toLocaleString()}
      </p>
      <p
        className={cn(
          "text-xs",
          isDark ? "text-gray-400" : "text-gray-500"
        )}
      >
        {title} this month
      </p>
    </div>
  );

  return (
    <Card
      className={cn(
        "border-0 shadow-lg overflow-hidden",
        isDark
          ? "bg-slate-800/50 backdrop-blur-sm shadow-slate-900/50"
          : "bg-white shadow-gray-200/50"
      )}
    >
      <CardHeader
        className={cn(
          "border-b",
          isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-100 bg-gray-50/50"
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={cn("text-lg", isDark ? "text-white" : "")}>
              Growth Trends
            </CardTitle>
            <CardDescription className={isDark ? "text-gray-400" : ""}>
              Monthly registration and activity trends
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Schools"
            value={trendsData.schools.totalThisMonth}
            growth={trendsData.schools.growthPercent}
            icon={School}
            color="#8b5cf6"
          />
          <StatCard
            title="Students"
            value={trendsData.students.totalThisMonth}
            growth={trendsData.students.growthPercent}
            icon={GraduationCap}
            color="#10b981"
          />
          <StatCard
            title="Activities"
            value={trendsData.activities.totalThisMonth}
            icon={Activity}
            color="#f59e0b"
          />
          <StatCard
            title="Teachers"
            value={trendsData.teachers.totalThisMonth}
            icon={BookOpen}
            color="#3b82f6"
          />
        </div>

        <Tabs defaultValue="area" className="w-full">
          <TabsList
            className={cn(
              "mb-4",
              isDark ? "bg-slate-700" : "bg-gray-100"
            )}
          >
            <TabsTrigger value="area">Area Chart</TabsTrigger>
            <TabsTrigger value="line">Line Chart</TabsTrigger>
          </TabsList>

          <TabsContent value="area" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={combinedData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorSchools" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTeachers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="name"
                    tick={axisStyle}
                    tickMargin={10}
                    axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                    tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                    height={45}
                  />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Schools"
                    stroke="#8b5cf6"
                    fillOpacity={1}
                    fill="url(#colorSchools)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Students"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorStudents)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Activities"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorActivities)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Teachers"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorTeachers)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="line" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={combinedData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="name"
                    tick={axisStyle}
                    tickMargin={10}
                    axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                    tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                    height={45}
                  />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Schools"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Students"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Activities"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: "#f59e0b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Teachers"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
