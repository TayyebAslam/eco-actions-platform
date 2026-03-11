/**
 * Teacher DTOs - Data Transfer Objects for Teacher Management
 */

export interface CreateTeacherDTO {
  email: string;
  first_name: string;
  last_name?: string;
  school_id: number;
}

export interface UpdateTeacherDTO {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
}

export interface TeacherFilters {
  search?: string;
  school_id?: number;
  is_active?: boolean;
}

export interface TeacherResponse {
  id: number;
  user_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  avatar_url: string | null;
  school_id: number;
  school_name: string;
  created_at: string;
}

export interface TeacherWithStatsResponse extends TeacherResponse {
  students_count: number;
}
