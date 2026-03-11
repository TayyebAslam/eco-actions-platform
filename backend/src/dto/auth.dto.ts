/**
 * Auth DTOs - Data Transfer Objects for Authentication
 */

export interface LoginDTO {
  email: string;
  password: string;
}

export interface SocialLoginDTO {
  email?: string;
  social_id: string;
}

export interface GoogleLoginDTO {
  id_token: string;
}

export interface AdminLoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
}

export interface AdminSignupDTO {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  data: string;
  password: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  password: string;
}

export interface VerifyEmailDTO {
  data: string;
}

export interface ResendVerificationDTO {
  email: string;
}

// Response DTOs
export interface AuthUserResponse {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  school_id: number | null;
  job_title_id?: number | null;
  job_title_name?: string | null;
  permissions?: Record<string, Record<string, boolean>> | null;
}

export interface LoginResponse {
  accessToken: string;
  sessionToken: string;
  user: AuthUserResponse;
}

export interface AdminLoginResponse extends LoginResponse {
  requiresSchoolSetup?: boolean;
  schoolRequestStatus?: string | null;
  rejectionReason?: string | null;
  reregistrationToken?: string | null;
}

export interface ChangePasswordResponse {
  showSessionModal: boolean;
  otherSessionCount: number;
}
