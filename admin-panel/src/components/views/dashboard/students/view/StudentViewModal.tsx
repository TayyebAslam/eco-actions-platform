"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  GraduationCap,
  Trophy,
  Award,
  Activity,
  Sparkles,
  Calendar,
  Mail,
  School,
  BookOpen,
  Flame,
  CheckCircle2,
  Clock,
  XCircle,
  ImageIcon,
  Users,
} from "lucide-react";
import { getInitials, formatDate, getAssetUrl } from "@/lib/utils";

interface StudentViewModalProps {
  studentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "info" | "academic" | "level" | "badges" | "activities" | "points";

export function StudentViewModal({
  studentId,
  open,
  onOpenChange,
}: StudentViewModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("info");

  const { data: studentData, isLoading } = useQuery({
    queryKey: ["student-details", studentId],
    queryFn: async () => {
      const response = await studentsApi.getById(Number(studentId));
      return response.data.data;
    },
    enabled: !!studentId && open,
  });

  const student = studentData;

  const tabs = [
    { id: "info" as TabType, label: "Student Info", mobileLabel: "Info", icon: User },
    { id: "academic" as TabType, label: "Academic Info", mobileLabel: "Academic", icon: GraduationCap },
    { id: "level" as TabType, label: "Level & Progress", mobileLabel: "Level", icon: Trophy },
    { id: "badges" as TabType, label: "Badges", mobileLabel: "Badges", icon: Award },
    { id: "activities" as TabType, label: "Activities", mobileLabel: "Activities", icon: Activity },
    { id: "points" as TabType, label: "Points", mobileLabel: "Points", icon: Sparkles },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      approved: { variant: "success", icon: CheckCircle2, label: "Approved" },
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
      rejected: { variant: "destructive", icon: XCircle, label: "Rejected" },
    };

    const config = statusConfig[status] ?? statusConfig["pending"]!;
    const Icon = config!.icon;

    return (
      <Badge variant={config!.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config!.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] md:w-[calc(100%-2rem)] xl:w-full max-w-5xl h-[92dvh] max-h-[92dvh] min-h-0 p-0 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)] xl:grid-rows-1">
          {/* Sidebar */}
          <div className="w-full shrink-0 border-b bg-muted/30 p-3 sm:p-4 xl:w-56 xl:border-b-0 xl:border-r">
            <DialogHeader className="mb-3 text-left sm:mb-4 xl:mb-6">
              <DialogTitle className="text-xl leading-none">Student Details</DialogTitle>
            </DialogHeader>

            <nav className="flex gap-2 overflow-x-auto pb-1 max-[848px]:grid max-[848px]:grid-cols-3 max-[848px]:gap-1.5 max-[848px]:overflow-visible max-[848px]:pb-0 xl:block xl:space-y-1 xl:overflow-visible xl:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors max-[848px]:w-full max-[848px]:shrink max-[848px]:justify-center max-[848px]:gap-1 max-[848px]:px-2 max-[848px]:text-xs max-[848px]:whitespace-nowrap xl:w-full xl:justify-start xl:gap-3 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 max-[848px]:h-3.5 max-[848px]:w-3.5" />
                    <span className="max-[848px]:hidden">{tab.label}</span>
                    <span className="hidden max-[848px]:inline">{tab.mobileLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="min-h-0 min-w-0 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-48 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : !student ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">Student not found</p>
                </div>
              ) : (
                <>
                  {/* Student Info Tab */}
                  {activeTab === "info" && (
                    <div className="space-y-6">
                      <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
                        <Avatar className="h-24 w-24">
                          <AvatarImage src={student.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="text-2xl">
                            {getInitials(student.name || student.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h2 className="text-xl font-bold sm:text-2xl">
                            {student.name || student.email}
                          </h2>
                          <p className="text-muted-foreground">{student.email}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant={student.is_active ? "success" : "secondary"}>
                              {student.is_active ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <Trophy className="h-3 w-3" />
                              Level {student.level}
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                              <Sparkles className="h-3 w-3" />
                              {student.total_points} points
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Full Name
                          </p>
                          <p className="font-medium">{student.name || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email
                          </p>
                          <p className="font-medium">{student.email}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Joined Date
                          </p>
                          <p className="font-medium">{formatDate(student.created_at)}</p>
                        </div>
                      </div>

                      {student.bio && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Bio</p>
                            <p className="text-sm leading-relaxed">{student.bio}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Academic Info Tab */}
                  {activeTab === "academic" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Academic Information</h3>
                        <div className={`grid grid-cols-1 gap-6 ${student.section_name ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10">
                                <School className="h-5 w-5 text-blue-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground">School</p>
                                <p className="font-semibold">{student.school_name}</p>
                              </div>
                            </div>
                          </Card>
                          <Card className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-emerald-500/10">
                                <BookOpen className="h-5 w-5 text-emerald-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground">Class</p>
                                <p className="font-semibold">{student.class_name}</p>
                              </div>
                            </div>
                          </Card>
                          {student.section_name && (
                            <Card className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10">
                                  <Users className="h-5 w-5 text-purple-500" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-muted-foreground">Section</p>
                                  <p className="font-semibold">{student.section_name}</p>
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-semibold">Enrollment Details</h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Student ID</p>
                            <p className="font-medium">#{student.user_id}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Status</p>
                            <Badge variant={student.is_active ? "success" : "secondary"}>
                              {student.is_active ? "Enrolled" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Level & Progress Tab */}
                  {activeTab === "level" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Level & Progress</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          <Card className="p-6">
                            <div className="flex flex-col items-center text-center">
                              <div className="p-3 rounded-full bg-amber-500/10 mb-3">
                                <Trophy className="h-8 w-8 text-amber-500" />
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">Current Level</p>
                              <p className="text-3xl font-bold">{student.level}</p>
                            </div>
                          </Card>
                          <Card className="p-6">
                            <div className="flex flex-col items-center text-center">
                              <div className="p-3 rounded-full bg-purple-500/10 mb-3">
                                <Sparkles className="h-8 w-8 text-purple-500" />
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">Total Points</p>
                              <p className="text-3xl font-bold">{student.total_points}</p>
                            </div>
                          </Card>
                          <Card className="p-6">
                            <div className="flex flex-col items-center text-center">
                              <div className="p-3 rounded-full bg-orange-500/10 mb-3">
                                <Flame className="h-8 w-8 text-orange-500" />
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">Streak Days</p>
                              <p className="text-3xl font-bold">{student.streak_days || 0}</p>
                            </div>
                          </Card>
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-4">Progress Overview</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <span className="text-sm">Activities Completed</span>
                            <span className="font-semibold">{student.activitiesCount || 0}</span>
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <span className="text-sm">Badges Earned</span>
                            <span className="font-semibold">{student.badges?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Badges Tab */}
                  {activeTab === "badges" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">
                          Earned Badges ({student.badges?.length || 0})
                        </h3>
                        {!student.badges || student.badges.length === 0 ? (
                          <Card className="p-12">
                            <div className="flex flex-col items-center justify-center text-center">
                              <Award className="h-12 w-12 text-muted-foreground mb-3" />
                              <p className="text-muted-foreground">No badges earned yet</p>
                            </div>
                          </Card>
                        ) : (
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {student.badges.map((badge: any) => (
                              <Card key={badge.id} className="p-4">
                                <div className="flex items-start gap-4">
                                  {badge.icon_url ? (
                                    <Image
                                      src={badge.icon_url || ""}
                                      alt={badge.name}
                                      width={64}
                                      height={64}
                                      className="h-16 w-16 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                      <Award className="h-8 w-8 text-white" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold mb-1">{badge.name}</h4>
                                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                      {badge.criteria}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(badge.earned_at)}
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Activities Tab */}
                  {activeTab === "activities" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">
                          Recent Activities ({student.activities?.length || 0})
                        </h3>
                        {!student.activities || student.activities.length === 0 ? (
                          <Card className="p-12">
                            <div className="flex flex-col items-center justify-center text-center">
                              <Activity className="h-12 w-12 text-muted-foreground mb-3" />
                              <p className="text-muted-foreground">No activities yet</p>
                            </div>
                          </Card>
                        ) : (
                          <div className="space-y-4">
                            {student.activities.map((activity: any) => (
                              <Card key={activity.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className="font-semibold">{activity.title}</h4>
                                      {getStatusBadge(activity.status)}
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      {activity.description}
                                    </p>
                                    {activity.photos && activity.photos.length > 0 && (
                                      <div className="flex gap-2 mb-3">
                                        {activity.photos.map((photo: string, idx: number) => (
                                          <div
                                            key={idx}
                                            className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted"
                                          >
                                            <Image
                                              src={getAssetUrl(photo) || ""}
                                              alt={`Activity ${idx + 1}`}
                                              fill
                                              className="object-cover"
                                              sizes="80px"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <Calendar className="h-3 w-3" />
                                          {formatDate(activity.created_at)}
                                        </div>
                                        {activity.points > 0 && (
                                          <div className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <Sparkles className="h-3 w-3" />
                                            +{activity.points} points
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Points Tab */}
                  {activeTab === "points" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Points Overview</h3>
                        <Card className="p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10">
                          <div className="flex flex-col items-center text-center">
                            <div className="p-4 rounded-full bg-purple-500/20 mb-4">
                              <Sparkles className="h-12 w-12 text-purple-500" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">Total Points Earned</p>
                            <p className="mb-2 text-4xl font-bold sm:text-5xl">{student.total_points}</p>
                            <p className="text-sm text-muted-foreground">
                              Across all activities and achievements
                            </p>
                          </div>
                        </Card>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold mb-4">Points Breakdown</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <Activity className="h-5 w-5 text-blue-500" />
                              <span className="text-sm">From Activities</span>
                            </div>
                            <span className="font-semibold">
                              {student.activities
                                ?.filter((a: any) => a.status === "approved")
                                .reduce((sum: number, a: any) => sum + (a.points || 0), 0) || 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                              <Award className="h-5 w-5 text-amber-500" />
                              <span className="text-sm">From Badges</span>
                            </div>
                            <span className="font-semibold">{student.badges?.length || 0}</span>
                          </div>
                        </div>
                      </div>

                      {student.activities && student.activities.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-semibold mb-4">Recent Point Gains</h4>
                            <div className="space-y-2">
                              {student.activities
                                .filter((a: any) => a.points > 0)
                                .slice(0, 5)
                                .map((activity: any) => (
                                  <div
                                    key={activity.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{activity.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDate(activity.created_at)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                                      <Sparkles className="h-4 w-4" />
                                      +{activity.points}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
