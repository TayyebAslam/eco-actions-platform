"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { useTheme } from "@/providers/theme-provider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from "lucide-react";

interface SchoolProgress {
  id: number;
  name: string;
  students: number;
  teachers: number;
  activities: number;
  approvedActivities: number;
  points: number;
}

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
];

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const SchoolsProgressChart = React.memo(function SchoolsProgressChart() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = React.useState("bar");

  const { data: schoolsData, isLoading } = useQuery({
    queryKey: ["schools-progress"],
    queryFn: async () => {
      try {
        const response = await dashboardApi.getSchoolsProgress();
        return response.data.data as SchoolProgress[];
      } catch {
        return [];
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

  if (!schoolsData || schoolsData.length === 0) {
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
            Schools Progress
          </CardTitle>
          <CardDescription className={isDark ? "text-gray-400" : ""}>
            No schools data available
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const normalizedSchoolsData = schoolsData.map((school) => ({
    ...school,
    students: toNumber(school.students),
    teachers: toNumber(school.teachers),
    activities: toNumber(school.activities),
    approvedActivities: toNumber(school.approvedActivities),
    points: toNumber(school.points),
  }));

  const barChartData = normalizedSchoolsData.map((school) => ({
    name: school.name.length > 15 ? school.name.substring(0, 15) + "..." : school.name,
    fullName: school.name,
    Students: school.students,
    Teachers: school.teachers,
    Activities: school.activities,
  }));

  const pieDataStudents = normalizedSchoolsData.map((school, index) => ({
    name: school.name,
    value: school.students,
    color: COLORS[index % COLORS.length],
  }));

  const pieDataPoints = normalizedSchoolsData.map((school, index) => ({
    name: school.name,
    value: school.points,
    color: COLORS[index % COLORS.length],
  }));

  const totalStudents = normalizedSchoolsData.reduce((sum, s) => sum + s.students, 0);
  const totalTeachers = normalizedSchoolsData.reduce((sum, s) => sum + s.teachers, 0);
  const totalActivities = normalizedSchoolsData.reduce((sum, s) => sum + s.activities, 0);
  const totalPoints = normalizedSchoolsData.reduce((sum, s) => sum + s.points, 0);
  const topStudentsSchool = normalizedSchoolsData.reduce(
    (max, school) => (school.students > (max?.students ?? -1) ? school : max),
    normalizedSchoolsData[0]
  );
  const topPointsSchool = normalizedSchoolsData.reduce(
    (max, school) => (school.points > (max?.points ?? -1) ? school : max),
    normalizedSchoolsData[0]
  );

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
            className="font-medium mb-2"
            style={{ color: isDark ? "#ffffff" : "#111827" }}
          >
            {payload[0]?.payload?.fullName || label}
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

  const CustomPieTooltip = ({ active, payload }: any) => {
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
            className="font-medium"
            style={{ color: isDark ? "#ffffff" : "#111827" }}
          >
            {payload[0].name}
          </p>
          <p className="text-sm" style={{ color: payload[0].payload.color }}>
            {payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

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
              Schools Progress Overview
            </CardTitle>
            <CardDescription className={isDark ? "text-gray-400" : ""}>
              Comparison of {schoolsData.length} active schools
            </CardDescription>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-500" />
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
            <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Students</p>
            <p className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
              {totalStudents.toLocaleString()}
            </p>
          </div>
          <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
            <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Teachers</p>
            <p className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
              {totalTeachers.toLocaleString()}
            </p>
          </div>
          <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
            <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Activities</p>
            <p className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
              {totalActivities.toLocaleString()}
            </p>
          </div>
          <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
            <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Points</p>
            <p className={cn("text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
              {totalPoints.toLocaleString()}
            </p>
          </div>
        </div>

        <Tabs defaultValue="bar" className="w-full" onValueChange={setActiveTab}>
          <TabsList className={cn("mb-4", isDark ? "bg-slate-700" : "bg-gray-100")}>
            <TabsTrigger value="bar" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Bar Chart
            </TabsTrigger>
            <TabsTrigger value="pie" className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Distribution
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bar" className="mt-0">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 24 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                  />
                  <XAxis
                    dataKey="name"
                    tick={axisStyle}
                    tickMargin={14}
                    height={52}
                    interval={0}
                    axisLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                    tickLine={{ stroke: isDark ? "#4b5563" : "#d1d5db" }}
                  />
                  <YAxis tick={axisStyle} />
                  <Tooltip
                    content={<CustomTooltip />}
                    wrapperStyle={{ outline: "none" }}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px" }} />
                  <Bar dataKey="Students" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Teachers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Activities" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="pie" className="mt-0">
            {activeTab === "pie" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
                    <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Students</p>
                    <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>{totalStudents.toLocaleString()}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
                    <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Total Points</p>
                    <p className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>{totalPoints.toLocaleString()}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
                    <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Top School (Students)</p>
                    <p className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-gray-900")}>{topStudentsSchool?.name || "N/A"}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg", isDark ? "bg-slate-700/50" : "bg-gray-50")}>
                    <p className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>Top School (Points)</p>
                    <p className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-gray-900")}>{topPointsSchool?.name || "N/A"}</p>
                  </div>
                </div>

                {totalStudents === 0 && totalPoints === 0 ? (
                  <div
                    className={cn(
                      "rounded-lg border p-4 text-sm text-center",
                      isDark ? "border-slate-700 text-gray-400" : "border-gray-200 text-gray-500"
                    )}
                  >
                    No distribution stats available yet.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4
                        className={cn(
                          "text-sm font-medium text-center mb-2",
                          isDark ? "text-gray-300" : "text-gray-700"
                        )}
                      >
                        Students Distribution
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieDataStudents}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {pieDataStudents.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} />
                            <Legend
                              layout="vertical"
                              align="right"
                              verticalAlign="middle"
                              wrapperStyle={{ lineHeight: "2rem" }}
                              formatter={(value) => (
                                <span style={{ color: isDark ? "#9ca3af" : "#6b7280", fontSize: "12px" }}>
                                  {value.length > 12 ? value.substring(0, 12) + "..." : value}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h4
                        className={cn(
                          "text-sm font-medium text-center mb-2",
                          isDark ? "text-gray-300" : "text-gray-700"
                        )}
                      >
                        Points Distribution
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieDataPoints}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {pieDataPoints.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} />
                            <Legend
                              layout="vertical"
                              align="right"
                              verticalAlign="middle"
                              wrapperStyle={{ lineHeight: "2rem" }}
                              formatter={(value) => (
                                <span style={{ color: isDark ? "#9ca3af" : "#6b7280", fontSize: "12px" }}>
                                  {value.length > 12 ? value.substring(0, 12) + "..." : value}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
