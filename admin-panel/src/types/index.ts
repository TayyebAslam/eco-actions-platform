export type UserRole =
  | "super_admin"
  | "super_sub_admin"
  | "admin"
  | "school_admin" // Legacy role name, kept for backward compatibility
  | "sub_admin"
  | "teacher"
  | "student";

export interface PermissionSet {
  can_create: boolean;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type PermissionsMap = Record<string, PermissionSet>;

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  permissions?: PermissionsMap;
  school_id?: number;
  job_title_id?: number | null;
  job_title_name?: string;
}

export interface Module {
  id: number;
  name: string;
  key: string;
  scope: "global" | "school";
}

export interface ModulePermission {
  module_id: number;
  name: string;
  key: string;
  scope: string;
  can_create: boolean;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserPermissions {
  user_id: number;
  role: UserRole;
  permissions: ModulePermission[];
}

export interface Admin extends User {
  school_id?: number;
  job_title?: string;
  created_by?: number;
  created_by_name?: string;
}

export interface SystemUser extends User {
  role: "super_sub_admin";
  created_by?: number;
  created_by_name?: string;
}

export interface Schools {
  id: number;
  name: string;
  slug?: string;
  logo_url?: string;
  address?: string;
  subscription_status: string;
  created_at: string;
  classes_count?: number;
  students_count?: number;
  staff_count?: number;
}

export interface Class {
  id: number;
  school_id: number;
  name: string;
  sections_count?: number;
}

export interface Section {
  id: number;
  class_id: number;
  name: string;
  students_count?: number;
}

export interface Student {
  user_id: number;
  email: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  school_id: number;
  school_name?: string;
  class_id?: number;
  class_name?: string;
  section_id?: number | null;
  section_name?: string | null;
  level: number;
  xp: number;
  total_points: number;
  streak_days: number;
  is_active: boolean;
}

export interface Teacher {
  user_id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  school_id: number;
  school_name?: string;
  job_title?: string;
  is_active: boolean;
  sections?: Section[];
}

export interface Category {
  id: number;
  name: string;
  icon_url?: string;
  color?: string;
  units?: string[];
}

export interface Activities {
  id: number;
  user_id: number;
  user_name?: string;
  school_id: number;
  school_name?: string;
  category_id: number;
  category_name?: string;
  title?: string;
  description?: string;
  photos?: string[];
  status: "pending" | "approved" | "rejected";
  points: number;
  created_at: string;
}

export interface Challenge {
  id: number;
  school_id?: number;
  school_name?: string;
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  variants?: ChallengeVariant[];
}

export interface ChallengeVariant {
  id: number;
  challenge_id: number;
  name?: string;
  description?: string;
  target_count?: number;
  target_unit?: string;
  points?: number;
}

export interface Article {
  id: number;
  school_id?: number;
  author_id: number;
  author_first_name?: string;
  author_last_name?: string;
  author_email?: string;
  category_id?: number;
  category_name?: string;
  title?: string;
  content?: string;
  thumbnail_image?: string;
  points: number;
  views_count?: number;
  bookmarks_count?: number;
  created_at?: string;
  school_name?: string;
}

export interface Badge {
  id: number;
  name?: string;
  icon_url?: string;
  criteria?: string;
  students_count?: number;
}

export interface Level {
  id: number;
  title?: string;
  min_xp?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface DashboardStats {
  totalUsers: number;
  totalSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalActivities: number;
  pendingActivities: number;
  totalChallenges: number;
  totalArticles: number;
}

export type NotificationType =
  | "activity_approved"
  | "activity_rejected"
  | "pending_activities"
  | "challenge_joined"
  | "school_request"
  | "new_article"
  | "comment_received"
  | "system_alert";

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  aggregate_count?: number | null;
  aggregate_key?: string | null;
  resource_type?: string | null;
  resource_id?: number | null;
  school_id?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_email: string | null;
  user_role: string | null;
  school_id: number | null;
  action: string;
  module: string;
  resource_id: number | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "failure";
  error_message: string | null;
  created_at: string;
}
