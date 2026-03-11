import axios from "axios";
import { API_ROUTES } from "./apiRoutes";

// Helper to get CSRF token from cookie
const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] ?? null : null;
};

const api = axios.create({
  baseURL: "/api/v1", // Uses Next.js rewrites to proxy to backend
  withCredentials: true,
  // Note: Don't set Content-Type header - axios auto-detects:
  // - FormData → multipart/form-data
  // - Object → application/json
});

// Request interceptor - Add CSRF token to state-changing requests
api.interceptors.request.use(
  (config) => {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (!safeMethods.includes(config.method?.toUpperCase() || "GET")) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/auth/login";
      }
    }
    // Handle CSRF token errors - refresh page to get new token
    if (error.response?.status === 403 && error.response?.data?.message?.includes("CSRF")) {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth APIs
export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post(API_ROUTES.AUTH.LOGIN_ADMIN, data),
  logout: () => api.post(API_ROUTES.AUTH.LOGOUT),
  checkSession: () => api.get(API_ROUTES.AUTH.CHECK_SESSION),
  forgotPassword: (email: string) =>
    api.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email }),
  verifyResetToken: (data: string) =>
    api.get(API_ROUTES.AUTH.VERIFY_RESET_TOKEN, { params: { data } }),
  resetPassword: (data: { data: string; password: string }) =>
    api.put(API_ROUTES.AUTH.RESET_PASSWORD, data),
  changePassword: (data: { currentPassword: string; password: string; confirmPassword: string }) =>
    api.put(API_ROUTES.AUTH.CHANGE_PASSWORD, data),
  requestEmailChange: (data: { new_email: string }) =>
    api.post(API_ROUTES.PROFILE.REQUEST_EMAIL_CHANGE, data),
  confirmEmailChange: (data: { new_email: string; otp: string }) =>
    api.put(API_ROUTES.PROFILE.CONFIRM_EMAIL_CHANGE, data),
  adminSignup: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) => api.post(API_ROUTES.AUTH.ADMIN_SIGNUP, data),
  verifyEmail: (data: string) =>
    api.get(API_ROUTES.AUTH.VERIFY_EMAIL, { params: { data } }),
  resendVerification: (email: string) =>
    api.post(API_ROUTES.AUTH.RESEND_VERIFICATION, { email }),
};

// Sessions APIs
export const sessionsApi = {
  getAll: () => api.get(API_ROUTES.SESSIONS.GET_ALL),
  revoke: (id: number) => api.delete(API_ROUTES.SESSIONS.REVOKE(id)),
  revokeAll: () => api.delete(API_ROUTES.SESSIONS.REVOKE_ALL),
  respond: (action: "logout_all" | "keep_all") =>
    api.post(API_ROUTES.SESSIONS.RESPOND, { action }),
};

// Profile APIs
export const profileApi = {
  get: () => api.get(API_ROUTES.PROFILE.GET),
  update: (data: FormData) =>
    api.put(API_ROUTES.PROFILE.UPDATE, data),
  updateImage: (file: File) => {
    const formData = new FormData();
    formData.append("profile_image", file);
    return api.put(API_ROUTES.PROFILE.UPDATE_IMAGE, formData);
  },
  deleteAccount: (password: string) =>
    api.delete(API_ROUTES.PROFILE.DELETE_PROFILE, {
      data: { password },
    }),
};

// Users APIs
export const usersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.USERS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.USERS.GET_BY_ID(id)),
  create: (data: FormData) =>
    api.post(API_ROUTES.USERS.CREATE, data),
  update: (id: number, data: FormData) =>
    api.patch(API_ROUTES.USERS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.USERS.DELETE(id)),
};

// Admins APIs
export const adminsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.ADMINS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.ADMINS.GET_BY_ID(id)),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    school_id?: number;
    job_title_id?: number;
  }) => api.post(API_ROUTES.ADMINS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.ADMINS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.ADMINS.DELETE(id)),
  toggleStatus: (id: number) => api.patch(API_ROUTES.ADMINS.TOGGLE_STATUS(id)),
  changePassword: (id: number, password: string) =>
    api.patch(API_ROUTES.ADMINS.CHANGE_PASSWORD(id), { password }),
};

// System Users APIs (Super Sub-Admins)
export const systemUsersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.SYSTEM_USERS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.SYSTEM_USERS.GET_BY_ID(id)),
  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    job_title_id?: number;
  }) => api.post(API_ROUTES.SYSTEM_USERS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.SYSTEM_USERS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.SYSTEM_USERS.DELETE(id)),
  toggleStatus: (id: number) => api.patch(API_ROUTES.SYSTEM_USERS.TOGGLE_STATUS(id)),
  changePassword: (id: number, password: string) =>
    api.patch(API_ROUTES.SYSTEM_USERS.CHANGE_PASSWORD(id), { password }),
};

// Permissions APIs
export const permissionsApi = {
  getModules: () => api.get(API_ROUTES.PERMISSIONS.GET_MODULES),
  getUserPermissions: (userId: number) =>
    api.get(API_ROUTES.PERMISSIONS.GET_USER_PERMISSIONS(userId)),
  updateUserPermissions: (
    userId: number,
    permissions: Array<{
      module_id: number;
      can_create: boolean;
      can_read: boolean;
      can_edit: boolean;
      can_delete: boolean;
    }>
  ) =>
    api.put(API_ROUTES.PERMISSIONS.UPDATE_USER_PERMISSIONS(userId), {
      permissions,
    }),
};

// Job Titles (Roles) APIs
export const jobTitlesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.JOB_TITLES.GET_ALL, { params }),
  getDropdown: () => api.get(API_ROUTES.JOB_TITLES.GET_DROPDOWN),
  getById: (id: string) => api.get(API_ROUTES.JOB_TITLES.GET_BY_ID(id)),
  create: (data: { name: string; description?: string; scope?: "global" | "system" | "school" }) =>
    api.post(API_ROUTES.JOB_TITLES.CREATE, data),
  update: (id: string, data: { name: string; description?: string; scope?: "global" | "system" | "school" }) =>
    api.put(API_ROUTES.JOB_TITLES.UPDATE(id), data),
  delete: (id: string, force?: boolean) =>
    api.delete(API_ROUTES.JOB_TITLES.DELETE(id), { params: force ? { force: "true" } : undefined }),
};

// Schools APIs
export const schoolsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.SCHOOLS.GET_ALL, { params }),
  getAllSchoolsWithName: () => api.get(API_ROUTES.SCHOOLS.GET_IDandNames),
  getById: (id: number) => api.get(API_ROUTES.SCHOOLS.GET_BY_ID(id)),
  create: (data: FormData) =>
    api.post(API_ROUTES.SCHOOLS.CREATE, data),
  update: (id: number, data: FormData) =>
    api.patch(API_ROUTES.SCHOOLS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.SCHOOLS.DELETE(id)),
  toggleStatus: (id: number) => api.patch(API_ROUTES.SCHOOLS.TOGGLE_STATUS(id)),
  setup: (data: FormData) =>
    api.post(API_ROUTES.SCHOOLS.SETUP, data),
};

// Classes APIs
export const classesApi = {
  getAll: (schoolId: number) => api.get(API_ROUTES.CLASSES.GET_ALL(schoolId)),
  getAllClasses: () => api.get(API_ROUTES.CLASSES.GET_ALL_CLASSES),
  create: (schoolId: number, data: { name: string }) =>
    api.post(API_ROUTES.CLASSES.CREATE(schoolId), data),
  update: (schoolId: number, classId: number, data: { name: string }) =>
    api.put(API_ROUTES.CLASSES.UPDATE(schoolId, classId), data),
  delete: (schoolId: number, classId: number) =>
    api.delete(API_ROUTES.CLASSES.DELETE(schoolId, classId)),
};

// Sections APIs
export const sectionsApi = {
  getAll: (classId: number) => api.get(API_ROUTES.SECTIONS.GET_ALL(classId)),
  create: (classId: number, data: { name: string }) =>
    api.post(API_ROUTES.SECTIONS.CREATE(classId), data),
  update: (classId: number, sectionId: number, data: { name: string }) =>
    api.put(API_ROUTES.SECTIONS.UPDATE(classId, sectionId), data),
  delete: (classId: number, sectionId: number) =>
    api.delete(API_ROUTES.SECTIONS.DELETE(classId, sectionId)),
};

// Students APIs
export const studentsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    school_id?: number;
    section_id?: number;
  }) => api.get(API_ROUTES.STUDENTS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.STUDENTS.GET_BY_ID(id)),
  create: (data: Record<string, unknown>) => api.post(API_ROUTES.STUDENTS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.STUDENTS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.STUDENTS.DELETE(id)),
  bulkUpload: (file: File, schoolId?: number) => {
    const formData = new FormData();
    formData.append("file", file);
    if (schoolId !== undefined) {
      formData.append("school_id", String(schoolId));
    }
    return api.post(API_ROUTES.STUDENTS.BULK_UPLOAD, formData);
  },
};

// Teachers APIs
export const teachersApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; school_id?: number }) =>
    api.get(API_ROUTES.TEACHERS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.TEACHERS.GET_BY_ID(id)),
  create: (data: Record<string, unknown>) => api.post(API_ROUTES.TEACHERS.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.TEACHERS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.TEACHERS.DELETE(id)),
  assignSection: (teacherId: number, sectionId: number) =>
    api.post(API_ROUTES.TEACHERS.ASSIGN_SECTION(teacherId, sectionId)),
  removeSection: (teacherId: number, sectionId: number) =>
    api.delete(API_ROUTES.TEACHERS.REMOVE_SECTION(teacherId, sectionId)),
  bulkUpload: (file: File, schoolId?: number) => {
    const formData = new FormData();
    formData.append("file", file);
    if (schoolId !== undefined) {
      formData.append("school_id", String(schoolId));
    }
    return api.post(API_ROUTES.TEACHERS.BULK_UPLOAD, formData);
  },
};

// Categories APIs
export const categoriesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.CATEGORIES.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.CATEGORIES.GET_BY_ID(id)),
  create: (data: FormData) =>
    api.post(API_ROUTES.CATEGORIES.CREATE, data),
  update: (id: number, data: FormData) =>
    api.put(API_ROUTES.CATEGORIES.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.CATEGORIES.DELETE(id)),
};

// Activities APIs
export const activitiesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get(API_ROUTES.ACTIVITIES.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.ACTIVITIES.GET_BY_ID(id)),
  approve: (id: number, points: number) =>
    api.patch(API_ROUTES.ACTIVITIES.APPROVE(id), { points }),
  reject: (id: number) => api.patch(API_ROUTES.ACTIVITIES.REJECT(id)),
  delete: (id: number) => api.delete(API_ROUTES.ACTIVITIES.DELETE(id)),
};

// Challenges APIs
export const challengesApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get(API_ROUTES.CHALLENGES.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.CHALLENGES.GET_BY_ID(id)),
  create: (data: Record<string, unknown>) =>
    api.post(API_ROUTES.CHALLENGES.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.CHALLENGES.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.CHALLENGES.DELETE(id)),
};

// Challenge Types APIs
export const challengeTypesApi = {
  getAll: (params?: { page?: number; limit?: number; is_active?: boolean }) =>
    api.get(API_ROUTES.CHALLENGE_TYPES.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.CHALLENGE_TYPES.GET_BY_ID(id)),
};

// Articles APIs
export const articlesApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get(API_ROUTES.ARTICLES.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.ARTICLES.GET_BY_ID(id)),
  create: (data: Record<string, unknown>) =>
    api.post(API_ROUTES.ARTICLES.CREATE, data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put(API_ROUTES.ARTICLES.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.ARTICLES.DELETE(id)),
  uploadThumbnail: (file: File) => {
    const formData = new FormData();
    formData.append("thumbnail", file);
    return api.post(API_ROUTES.ARTICLES.UPLOAD_THUMBNAIL, formData);
  },
  uploadEditorImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post(API_ROUTES.ARTICLES.UPLOAD_EDITOR_IMAGE, formData);
  },
};

// Badges APIs
export const badgesApi = {
  getAll: () => api.get(API_ROUTES.BADGES.GET_ALL),
  getById: (id: number) => api.get(API_ROUTES.BADGES.GET_BY_ID(id)),
  create: (data: FormData) =>
    api.post(API_ROUTES.BADGES.CREATE, data),
  update: (id: number, data: FormData) =>
    api.put(API_ROUTES.BADGES.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.BADGES.DELETE(id)),
};

// Levels APIs
export const levelsApi = {
  getAll: () => api.get(API_ROUTES.LEVELS.GET_ALL),
  getById: (id: number) => api.get(API_ROUTES.LEVELS.GET_BY_ID(id)),
  create: (data: { id: number; title: string; min_xp: number }) =>
    api.post(API_ROUTES.LEVELS.CREATE, data),
  update: (
    id: number,
    data: { id?: number; title?: string; min_xp?: number }
  ) => api.put(API_ROUTES.LEVELS.UPDATE(id), data),
  delete: (id: number) => api.delete(API_ROUTES.LEVELS.DELETE(id)),
  applyFormula: (data: {
    total_levels: number;
    base_min_xp: number;
    initial_gap: number;
    tier_size: number;
    base_increment: number;
    growth_divisor: number;
    title_prefix: string;
  }) => api.post(API_ROUTES.LEVELS.APPLY_FORMULA, data),
};

// Dashboard APIs
export const dashboardApi = {
  getStats: () => api.get(API_ROUTES.DASHBOARD.STATS),
  getRecentActivities: () => api.get(API_ROUTES.DASHBOARD.RECENT_ACTIVITIES),
  getSchoolsProgress: () => api.get(API_ROUTES.DASHBOARD.SCHOOLS_PROGRESS),
  getGrowthTrends: (months?: number) =>
    api.get(API_ROUTES.DASHBOARD.GROWTH_TRENDS, { params: { months } }),
  getWeeklyStats: () => api.get(API_ROUTES.DASHBOARD.WEEKLY_STATS),
};

// School Registration APIs (Public)
export const schoolRequestsApi = {
  initiate: (data: {
    admin_email: string;
    admin_first_name: string;
    admin_last_name: string;
    admin_password: string;
  }) => api.post(API_ROUTES.SCHOOL_REQUESTS.INITIATE, data),
  verify: (data: string) => api.get(API_ROUTES.SCHOOL_REQUESTS.VERIFY, { params: { data } }),
  complete: (data: FormData) =>
    api.post(API_ROUTES.SCHOOL_REQUESTS.COMPLETE, data),
  reregister: (data: FormData) =>
    api.post(API_ROUTES.SCHOOL_REQUESTS.REREGISTER, data),
};

// Notifications APIs
export const notificationsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    is_read?: boolean;
    type?: string;
  }) => api.get(API_ROUTES.NOTIFICATIONS.GET_ALL, { params }),
  markAsRead: (id: number) => api.patch(API_ROUTES.NOTIFICATIONS.MARK_AS_READ(id)),
  markAllAsRead: () => api.patch(API_ROUTES.NOTIFICATIONS.MARK_ALL_READ),
};

// Push Tokens APIs
export const pushTokensApi = {
  register: (data: {
    token: string;
    device_type?: string;
    device_name?: string;
  }) => api.post(API_ROUTES.PUSH_TOKENS.REGISTER, data),
  unregister: (data: { token: string }) =>
    api.post(API_ROUTES.PUSH_TOKENS.UNREGISTER, data),
};

// Audit Logs APIs
export const auditLogsApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    user_id?: number;
    action?: string;
    module?: string;
    status?: "success" | "failure";
    start_date?: string;
    end_date?: string;
  }) => api.get(API_ROUTES.AUDIT_LOGS.GET_ALL, { params }),
  getById: (id: number) => api.get(API_ROUTES.AUDIT_LOGS.GET_BY_ID(id)),
};
