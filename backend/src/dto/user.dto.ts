/**
 * User DTOs - Data Transfer Objects for User Management
 */

export interface CreateUserDTO {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id?: number;
  section_id?: number;
  is_active?: boolean;
}

export interface UpdateUserDTO {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  avatar_url?: string;
  school_id?: number;
  section_id?: number;
}

export interface UserFilters {
  search?: string;
  role?: string;
  school_id?: number;
  is_active?: boolean;
}

export interface ExtendedUserFilters extends UserFilters {
  class_id?: number | string;
  section_id?: number | string;
  sort_by?: string;
  sort_order?: string;
}

export interface StatsRow {
  total_students: number | string;
  active_students: number | string;
  inactive_students: number | string;
  avg_points: number | string;
}

export interface BadgeCountRow {
  user_id: number;
  badges_count: number | string;
}

export interface ActivityStatsRow {
  user_id: number;
  activities_count: number | string;
  last_activity_at: Date | string;
}

export interface UserQueryRow {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: Date;
  role?: string;
  level_id?: number;
  total_points?: number;
  streak_days?: number;
  class_id?: number;
  section_id?: number;
  class_name?: string;
  section_name?: string;
  level_title?: string;
}

export interface WeeklyPointsRow {
  day: Date | string;
  points: number | string;
}

export interface ActivityBreakdownRow {
  category_id: number;
  category_name: string;
  activities_count: number | string;
  points: number | string;
}

export interface RecentBadgeRow {
  id: number;
  name: string;
  icon_url: string | null;
  earned_at: Date | string;
}

export interface RecentActivityRow {
  id: number;
  title: string;
  category_name: string | null;
  status: string;
  points: number;
  created_at: Date | string;
}

export interface SchoolRankRow {
  position: number | string;
  total_students: number | string;
}

export interface PaginationDTO {
  page: number;
  limit: number;
}

export interface UserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SchoolUsersStats {
  total_students: number;
  active_students: number;
  inactive_students: number;
  avg_points: number;
}

export interface SchoolUserListItem {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  role: string;
  level_id: number;
  total_points: number;
  streak_days: number;
  class_id: number | null;
  section_id: number | null;
  class_name: string | null;
  section_name: string | null;
  level_title: string | null;
  name: string;
  level: {
    id: number;
    title: string;
  };
  grade: {
    class_id: number | null;
    class_name: string | null;
  };
  section: {
    section_id: number | null;
    section_name: string | null;
  };
  points: number;
  activities_count: number;
  badges_count: number;
  last_activity_at: string | null;
}

export interface SchoolUsersPaginatedResponse extends PaginatedResponse<SchoolUserListItem> {
  stats: SchoolUsersStats;
}

export interface SchoolUserDetailResponse {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  avatar_url: string | null;
  joined_at: string | null;
  level: {
    id: number;
    title: string;
  };
  grade: {
    class_id: number | null;
    class_name: string | null;
  };
  section: {
    section_id: number | null;
    section_name: string | null;
  };
  class_section_label: string | null;
  stats: {
    total_points: number;
    activities_count: number;
    badges_count: number;
    current_streak_days: number;
    last_activity_at: string | null;
  };
}

export interface SchoolUserStatsResponse extends SchoolUserDetailResponse {
  performance_overview: {
    this_week_activities: number;
    this_month_activities: number;
    completed_challenges: number;
    articles_read: number;
    school_rank: {
      position: number;
      total_students: number;
    } | null;
  };
  weekly_activity: {
    total_points: number;
    points_by_day: Array<{
      day: string;
      date: string;
      points: number;
    }>;
  };
  activity_breakdown: Array<{
    category_id: number;
    category_name: string;
    activities_count: number;
    points: number;
  }>;
  recent_badges: Array<{
    id: number;
    name: string;
    icon_url: string | null;
    earned_at: string | null;
  }>;
  recent_activities: Array<{
    id: number;
    title: string | null;
    category_name: string | null;
    status: string | null;
    points: number;
    created_at: string | null;
  }>;
}

// Backward-compat alias
export type SchoolUserStatsDetailResponse = SchoolUserStatsResponse;

export interface ExportUserRow {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  level_id: number;
  level_title: string;
  class_id: number | null;
  class_name: string | null;
  section_id: number | null;
  section_name: string | null;
  total_points: number;
  activities_count: number;
  badges_count: number;
  streak_days: number;
  last_activity_at: string | null;
  joined_at: string | null;
}
