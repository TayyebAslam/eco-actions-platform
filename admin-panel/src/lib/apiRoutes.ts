/**
 * Centralized API Routes Configuration
 * All API endpoints are defined here with their keys
 * Usage: import { API_ROUTES } from "@/lib/apiRoutes"
 */

export const API_ROUTES = {
  // Auth Routes
  AUTH: {
    LOGIN_ADMIN: "/auth/login-admin",
    LOGOUT: "/auth/logout",
    CHECK_SESSION: "/auth/check-session",
    FORGOT_PASSWORD: "/auth/forget-password",
    VERIFY_RESET_TOKEN: "/auth/verify-reset-token",
    RESET_PASSWORD: "/auth/reset-password",
    ADMIN_SIGNUP: "/auth/admin-signup",
    VERIFY_EMAIL: "/auth/verify-email",
    RESEND_VERIFICATION: "/auth/resend-verification",
    CHANGE_PASSWORD: "/auth/change-password",
  },

  // Sessions Routes
  SESSIONS: {
    GET_ALL: "/sessions",
    REVOKE: (id: number) => `/sessions/${id}`,
    REVOKE_ALL: "/sessions/all",
    RESPOND: "/sessions/respond",
  },

  // Profile Routes
  PROFILE: {
    GET: "/profile",
    UPDATE: "/profile",
    UPDATE_IMAGE: "/profile/image",
    REQUEST_EMAIL_CHANGE: "/profile/request-email-change",
    CONFIRM_EMAIL_CHANGE: "/profile/confirm-email-change",
    DELETE_PROFILE: "/profile/delete-account",
  },

  // Admin Routes
  ADMINS: {
    BASE: "/admin/admins",
    GET_ALL: "/admin/admins",
    GET_BY_ID: (id: number) => `/admin/admins/${id}`,
    CREATE: "/admin/admins",
    UPDATE: (id: number) => `/admin/admins/${id}`,
    DELETE: (id: number) => `/admin/admins/${id}`,
    TOGGLE_STATUS: (id: number) => `/admin/admins/${id}/toggle-status`,
    CHANGE_PASSWORD: (id: number) => `/admin/admins/${id}/change-password`,
  },

  // System Users Routes (Super Sub-Admins)
  SYSTEM_USERS: {
    BASE: "/admin/system-users",
    GET_ALL: "/admin/system-users",
    GET_BY_ID: (id: number) => `/admin/system-users/${id}`,
    CREATE: "/admin/system-users",
    UPDATE: (id: number) => `/admin/system-users/${id}`,
    DELETE: (id: number) => `/admin/system-users/${id}`,
    TOGGLE_STATUS: (id: number) => `/admin/system-users/${id}/toggle-status`,
    CHANGE_PASSWORD: (id: number) => `/admin/system-users/${id}/change-password`,
  },

  // Permissions Routes
  PERMISSIONS: {
    GET_MODULES: "/admin/modules",
    GET_USER_PERMISSIONS: (userId: number) => `/admin/users/${userId}/permissions`,
    UPDATE_USER_PERMISSIONS: (userId: number) => `/admin/users/${userId}/permissions`,
  },

  // Job Titles (Roles) Routes
  JOB_TITLES: {
    BASE: "/admin/job-titles",
    GET_ALL: "/admin/job-titles",
    GET_DROPDOWN: "/admin/job-titles/dropdown",
    GET_BY_ID: (id: string) => `/admin/job-titles/${id}`,
    CREATE: "/admin/job-titles",
    UPDATE: (id: string) => `/admin/job-titles/${id}`,
    DELETE: (id: string) => `/admin/job-titles/${id}`,
  },

  // Users Routes
  USERS: {
    BASE: "/admin/users",
    GET_ALL: "/admin/users",
    GET_BY_ID: (id: number) => `/admin/users/${id}`,
    CREATE: "/admin/users",
    UPDATE: (id: number) => `/admin/users/${id}`,
    DELETE: (id: number) => `/admin/users/${id}`,
  },

  // Schools Routes
  SCHOOLS: {
    BASE: "/admin/schools",
    GET_ALL: "/admin/schools",
    GET_IDandNames: "/admin/schools/ids/names",
    GET_BY_ID: (id: number) => `/admin/schools/${id}`,
    CREATE: "/admin/schools",
    UPDATE: (id: number) => `/admin/schools/${id}`,
    DELETE: (id: number) => `/admin/schools/${id}`,
    TOGGLE_STATUS: (id: number) => `/admin/schools/${id}/toggle-status`,
    SETUP: "/admin/schools/setup",
  },

  // Classes Routes
  CLASSES: {
    GET_ALL: (schoolId: number) => `/admin/schools/${schoolId}/classes`,
    GET_ALL_CLASSES: "/admin/classes",
    CREATE: (schoolId: number) => `/admin/schools/${schoolId}/classes`,
    UPDATE: (schoolId: number, classId: number) => `/admin/schools/${schoolId}/classes/${classId}`,
    DELETE: (schoolId: number, classId: number) => `/admin/schools/${schoolId}/classes/${classId}`,
  },

  // Sections Routes
  SECTIONS: {
    GET_ALL: (classId: number) => `/admin/classes/${classId}/sections`,
    CREATE: (classId: number) => `/admin/classes/${classId}/sections`,
    UPDATE: (classId: number, sectionId: number) => `/admin/classes/${classId}/sections/${sectionId}`,
    DELETE: (classId: number, sectionId: number) => `/admin/classes/${classId}/sections/${sectionId}`,
  },

  // Students Routes
  STUDENTS: {
    BASE: "/admin/students",
    GET_ALL: "/admin/students",
    GET_BY_ID: (id: number) => `/admin/students/${id}`,
    CREATE: "/admin/students",
    UPDATE: (id: number) => `/admin/students/${id}`,
    DELETE: (id: number) => `/admin/students/${id}`,
    BULK_UPLOAD: "/admin/students/bulk-upload",
  },

  // Teachers Routes
  TEACHERS: {
    BASE: "/admin/teachers",
    GET_ALL: "/admin/teachers",
    GET_BY_ID: (id: number) => `/admin/teachers/${id}`,
    CREATE: "/admin/teachers",
    UPDATE: (id: number) => `/admin/teachers/${id}`,
    DELETE: (id: number) => `/admin/teachers/${id}`,
    ASSIGN_SECTION: (teacherId: number, sectionId: number) => `/admin/teachers/${teacherId}/sections/${sectionId}`,
    REMOVE_SECTION: (teacherId: number, sectionId: number) => `/admin/teachers/${teacherId}/sections/${sectionId}`,
    BULK_UPLOAD: "/admin/teachers/bulk-upload",
  },

  // Categories Routes
  CATEGORIES: {
    BASE: "/admin/categories",
    GET_ALL: "/admin/categories",
    GET_BY_ID: (id: number) => `/admin/categories/${id}`,
    CREATE: "/admin/categories",
    UPDATE: (id: number) => `/admin/categories/${id}`,
    DELETE: (id: number) => `/admin/categories/${id}`,
  },

  // Activities Routes
  ACTIVITIES: {
    BASE: "/admin/activities",
    GET_ALL: "/admin/activities",
    GET_BY_ID: (id: number) => `/admin/activities/${id}`,
    APPROVE: (id: number) => `/admin/activities/${id}/approve`,
    REJECT: (id: number) => `/admin/activities/${id}/reject`,
    DELETE: (id: number) => `/admin/activities/${id}`,
  },

  // Challenges Routes
  CHALLENGES: {
    BASE: "/admin/challenges",
    GET_ALL: "/admin/challenges",
    GET_BY_ID: (id: number) => `/admin/challenges/${id}`,
    CREATE: "/admin/challenges",
    UPDATE: (id: number) => `/admin/challenges/${id}`,
    DELETE: (id: number) => `/admin/challenges/${id}`,
  },

  // Challenge Types Routes
  CHALLENGE_TYPES: {
    BASE: "/admin/challenge-types",
    GET_ALL: "/admin/challenge-types",
    GET_BY_ID: (id: number) => `/admin/challenge-types/${id}`,
  },

  // Articles Routes
  ARTICLES: {
    BASE: "/admin/articles",
    GET_ALL: "/admin/articles",
    GET_BY_ID: (id: number) => `/admin/articles/${id}`,
    CREATE: "/admin/articles",
    UPDATE: (id: number) => `/admin/articles/${id}`,
    DELETE: (id: number) => `/admin/articles/${id}`,
    UPLOAD_THUMBNAIL: "/admin/articles/upload-thumbnail",
    UPLOAD_EDITOR_IMAGE: "/admin/articles/upload-editor-image",
  },

  // Badges Routes
  BADGES: {
    BASE: "/admin/badges",
    GET_ALL: "/admin/badges",
    GET_BY_ID: (id: number) => `/admin/badges/${id}`,
    CREATE: "/admin/badges",
    UPDATE: (id: number) => `/admin/badges/${id}`,
    DELETE: (id: number) => `/admin/badges/${id}`,
  },

  // Levels Routes
  LEVELS: {
    BASE: "/admin/levels",
    GET_ALL: "/admin/levels",
    GET_BY_ID: (id: number) => `/admin/levels/${id}`,
    CREATE: "/admin/levels",
    UPDATE: (id: number) => `/admin/levels/${id}`,
    DELETE: (id: number) => `/admin/levels/${id}`,
    APPLY_FORMULA: "/admin/levels/apply-formula",
  },

  // Dashboard Routes
  DASHBOARD: {
    STATS: "/admin/dashboard/stats",
    RECENT_ACTIVITIES: "/admin/dashboard/recent-activities",
    SCHOOLS_PROGRESS: "/admin/dashboard/schools-progress",
    GROWTH_TRENDS: "/admin/dashboard/growth-trends",
    WEEKLY_STATS: "/admin/dashboard/weekly-stats",
  },

  // School Registration Routes (Public)
  SCHOOL_REQUESTS: {
    INITIATE: "/school-requests/initiate",
    VERIFY: "/school-requests/verify",
    COMPLETE: "/school-requests/complete",
    REREGISTER: "/school-requests/reregister",
  },

  // Notifications Routes
  NOTIFICATIONS: {
    GET_ALL: "/admin/notifications",
    MARK_AS_READ: (id: number) => `/admin/notifications/${id}/read`,
    MARK_ALL_READ: "/admin/notifications/read-all",
  },

  // Push Token Routes
  PUSH_TOKENS: {
    REGISTER: "/push-tokens/register",
    UNREGISTER: "/push-tokens/unregister",
  },

  // Audit Logs Routes
  AUDIT_LOGS: {
    BASE: "/admin/audit-logs",
    GET_ALL: "/admin/audit-logs",
    GET_BY_ID: (id: number) => `/admin/audit-logs/${id}`,
  },
} as const;

// Type for API Routes
export type ApiRoutesType = typeof API_ROUTES;
