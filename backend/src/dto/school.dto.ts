/**
 * School DTOs - Data Transfer Objects for School Management
 */

export interface CreateSchoolDTO {
  name: string;
  slug?: string;
  address?: string;
  subscription_status?: string;
  logo_url?: string;
}

export interface UpdateSchoolDTO {
  name?: string;
  slug?: string;
  address?: string;
  subscription_status?: string;
  logo_url?: string;
}

export interface SchoolFilters {
  search?: string;
  subscription_status?: string;
}

export interface SchoolResponse {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  subscription_status: string;
  created_at: string;
  updated_at: string;
}

export interface SchoolWithStatsResponse extends SchoolResponse {
  classes_count: number;
  students_count: number;
  staff_count: number;
}

export interface SchoolRequestDTO {
  name: string;
  slug?: string;
  address?: string;
  logo_url?: string;
}

export interface SchoolRequestResponse {
  request_id: number;
  status: string;
}
