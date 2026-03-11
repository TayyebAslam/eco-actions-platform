/**
 * Student DTOs - Data Transfer Objects for Student Management
 */

export interface CreateStudentDTO {
  email: string;
  name: string;
  school_id: number;
  class_id: number;
  section_id?: number;
}

export interface UpdateStudentDTO {
  email?: string;
  name?: string;
  school_id?: number;
  class_id?: number;
  section_id?: number | null;
  is_active?: boolean;
  avatar_url?: string;
}

export interface StudentFilters {
  search?: string;
  school_id?: number;
  class_id?: number;
  section_id?: number;
  is_active?: boolean;
}

export interface StudentResponse {
  id: number;
  user_id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  avatar_url: string | null;
  school_id: number;
  school_name: string;
  class_id: number;
  class_name: string;
  section_id: number | null;
  section_name: string | null;
  level: number;
  total_points: number;
  created_at: string;
}

export interface StudentWithBadgesResponse extends StudentResponse {
  badges: BadgeResponse[];
  activitiesCount: number;
  levelInfo: LevelInfo | null;
}

export interface BadgeResponse {
  id: number;
  name: string;
  criteria: string;
  icon_url: string;
  earned_at: string;
}

export interface LevelInfo {
  id: number;
  name: string;
  min_points: number;
  max_points: number;
}

export type LeaderboardPeriod = "week" | "month" | "semester" | "all_time";

export interface LeaderboardPeriodRange {
  start: string;
  end: string;
}

export interface LeaderboardPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StudentLeaderboardEntry {
  user_id: number;
  name: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  total_points: number;
  period_points: number;
  position: number;
}

export interface SchoolLeaderboardEntry {
  school_id: number;
  school_name: string;
  logo_url: string | null;
  level: number;
  members_count: number;
  period_points: number;
  position: number;
  is_my_school: boolean;
}

export interface GetStudentLeaderboardParams {
  schoolId: number;
  userId: number;
  page?: number;
  limit?: number;
  period?: LeaderboardPeriod;
  categoryId?: number;
}

export interface StudentLeaderboardResponse {
  period: LeaderboardPeriod;
  period_range: LeaderboardPeriodRange | null;
  category_id: number | null;
  top_three: StudentLeaderboardEntry[];
  others: StudentLeaderboardEntry[];
  me: StudentLeaderboardEntry | null;
  pagination: LeaderboardPagination;
}

export interface GetSchoolsLeaderboardParams {
  userSchoolId: number;
  page?: number;
  limit?: number;
  period?: LeaderboardPeriod;
  categoryId?: number;
}

export interface SchoolsLeaderboardResponse {
  period: LeaderboardPeriod;
  period_range: LeaderboardPeriodRange | null;
  category_id: number | null;
  top_three: SchoolLeaderboardEntry[];
  others: SchoolLeaderboardEntry[];
  my_school: SchoolLeaderboardEntry | null;
  pagination: LeaderboardPagination;
}

export interface StudentDashboardResponse {
  student: {
    user_id: number;
    name: string;
    avatar_url: string | null;
  };
  points: {
    total_points: number;
    semester_points: number;
  };
  level: {
    current_level_id: number;
    current_level_title: string;
    current_xp: number;
    next_level_id: number | null;
    next_level_title: string | null;
    next_level_min_xp: number | null;
    xp_needed_for_next_level: number;
    progress_percent: number;
  };
  streak_days: number;
  badges_count: number;
  challenges: {
    in_progress: number;
    completed: number;
  };
  points_by_category: Array<{
    category_id: number;
    category_name: string;
    category_icon: string | null;
    points: number;
  }>;
  semester_range: {
    start: string;
    end: string;
  };
}
