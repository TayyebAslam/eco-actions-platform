/**
 * Activity DTOs - Data Transfer Objects for Activity Management
 */

export interface ActivityFilters {
  status?: string;
  school_id?: number;
  category_id?: number;
  search?: string;
  user_id?: number;
}

export interface ApproveActivityDTO {
  points: number;
}

export interface RejectActivityDTO {
  rejection_reason: string;
}

export interface CreateActivityDTO {
  title: string;
  description?: string;
  category_id: number;
  photos?: string[];
}

export interface ActivityResponse {
  id: number;
  title: string;
  description: string | null;
  photos: string[];
  status: string;
  points: number | null;
  challenge_activity: boolean;
  challenge_variant_id: number | null;
  challenge_title: string | null;
  challenge_description: string | null;
  rejection_reason: string | null;
  user_id: number;
  user_email: string | null;
  first_name: string | null;
  last_name: string | null;
  category_id: number | null;
  category_name: string | null;
  school_id: number | null;
  school_name: string | null;
  created_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
}

export interface ActivityWithStatsResponse extends ActivityResponse {
  likes_count: number;
  comments_count: number;
  category_icon: string | null;
  reviewer: ReviewerInfo | null;
}

export interface ReviewerInfo {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface FeedComment {
  id: number;
  activity_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface FeedCommentWithUser extends FeedComment {
  first_name: string | null;
  last_name: string | null;
}

export interface ReportFeedActivityParams {
  activityId: number;
  userId: number;
  schoolId: number;
  reason: string;
  description?: string;
}

export interface ReportFeedActivityResponse {
  report_id: number;
  activity_id: number;
  reason: string;
}

export interface GetReportedActivitiesForTeacherParams {
  schoolId: number;
  page?: number;
  limit?: number;
  status?: "pending" | "reviewed" | "all";
  type?: "all" | "activity" | "comment" | "post";
  priority?: "low" | "medium" | "high";
}

export interface ReportedActivityListItem {
  type: "activity";
  status: "pending";
  priority: "low" | "medium" | "high";
  reports_count: number;
  activity_id: number;
  activity_title: string | null;
  activity_description: string | null;
  activity_created_at: string | null;
  activity_owner: {
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  latest_report: {
    reason: string;
    description: string | null;
    reported_at: string;
    reporter: {
      user_id: number;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    };
  } | null;
}

export interface ReportedActivitiesStats {
  ai_flagged: number;
  user_reported: number;
  high_priority: number;
  pending: number;
  reviewed: number;
}

export interface GetReportedActivitiesForTeacherResponse {
  stats: ReportedActivitiesStats;
  data: ReportedActivityListItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ModerateReportedActivityForTeacherParams {
  activityId: number;
  schoolId: number;
  reviewerId: number;
  action: "approve" | "remove";
  note?: string;
}

export interface ModerateReportedActivityForTeacherResponse {
  activity_id: number;
  action: "approve" | "remove";
  reports_cleared: number;
}

export interface GetReportedActivityDetailForTeacherParams {
  activityId: number;
  schoolId: number;
}

export interface GetReportedActivityDetailForTeacherResponse {
  activity: {
    id: number;
    title: string | null;
    description: string | null;
    created_at: string | null;
    user_id: number;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    category_name: string | null;
    status: string | null;
  };
  moderation: {
    reports_count: number;
    priority: "low" | "medium" | "high";
    top_reason: string | null;
    latest_reported_at: string | null;
  };
  reports: Array<{
    id: number;
    reason: string;
    description: string | null;
    created_at: string;
    reporter: {
      user_id: number;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    };
  }>;
}

