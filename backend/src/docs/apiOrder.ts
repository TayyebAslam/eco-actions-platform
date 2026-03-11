/**
 * 🎯 Swagger API Display Order
 * 
 * Instructions:
 * - Niche array mein jo endpoint pehle hoga, wo Swagger mein pehle dikhega
 * - Endpoints ko upar/neeche move kar ke order change kar sakte ho
 * - Save karke server restart karein (nodemon auto-reload kar dega)
 *
 * Example:
 * - Agar email change APIs ko upar lana hai to unhe array mein upar move karo
 */

export const apiOrder = [
  // === Profile APIs ===
  "/profile",
  "/profile/request-email-change",
  "/profile/confirm-email-change",

  // === Auth APIs ===
  "/auth/login-user",
  "/auth/google-login",
  "/auth/login-admin",
  "/auth/logout",
  "/auth/check-session",
  "/auth/forget-password",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/delete-account",

  // === Student Challenge APIs ===
  "/student/challenges",
  "/student/challenges/my-challenges",
  "/student/challenges/{id}",
  "/student/challenges/{id}/join",
  "/student/challenges/{id}/leave",
  "/student/challenges/progress/{progressId}",
  "/student/dashboard",

  // === Student Activity APIs ===
  "/student/activities",
  "/student/activities/feed",
  "/student/activities/bookmarks",
  "/student/activities/{id}/share",
  "/student/activities/{id}/like",
  "/student/activities/{id}/comments",
  "/student/activities/{id}/bookmark",
  "/student/activities/{id}/report",
  "/student/articles/{id}/view",
  "/student/articles/{id}/read",
  "/student/articles/{id}/bookmark",
  "/student/articles/bookmarks",

  // === Teacher APIs ===
  "/teacher/users",
  "/teacher/users/export",
  "/teacher/users/{id}/flag",
  "/teacher/users/{id}/stats",
  "/teacher/users/{id}",
  "/teacher/activities",
  "/teacher/reported-activities",
  "/teacher/reported-activities/{activityId}",
  "/teacher/reported-activities/{activityId}/action",
  "/teacher/activities/{activityId}/review",
  "/teacher/articles/upload-editor-image",
  "/teacher/articles/upload-thumbnail",
  "/teacher/articles",
  "/teacher/articles/{id}",

  // === Admin Management APIs ===
  "/admin/admins",
  "/admin/admins/{id}",
  "/admin/admins/{id}/toggle-status",
  "/admin/categories",
  "/admin/activities",
  "/admin/activities/{id}",
  "/admin/articles",
  "/admin/articles/{id}",
  "/admin/levels",
  "/admin/levels/{id}",
  "/admin/levels/apply-formula",
  "/admin/system-users",
  "/admin/system-users/{id}",
  "/admin/system-users/{id}/toggle-status",
  "/admin/system-users/{id}/change-password",

  // === Teacher APIs ===
  "/teacher/users",
  "/teacher/users/export",
  "/teacher/users/{id}/flag",
  "/teacher/users/{id}/stats",
  "/teacher/users/{id}",
  "/teacher/activities",
  "/teacher/reported-activities",
  "/teacher/reported-activities/{activityId}",
  "/teacher/reported-activities/{activityId}/action",
  "/teacher/activities/{activityId}/review",
];

/**
 * Usage:
 *
 * Agar email change APIs ko upar lana hai:
 *
 * BEFORE:
 * [
 *   "/auth/login-user",
 *   "/auth/logout",
 *   "/auth/change-password",
 *   "/auth/request-email-change",    ← Neeche hai
 *   "/auth/confirm-email-change"     ← Neeche hai
 * ]
 *
 * AFTER (cut-paste kar ke move karein):
 * [
 *   "/auth/login-user",
 *   "/auth/request-email-change",    ← Upar move kar diya
 *   "/auth/confirm-email-change",    ← Upar move kar diya
 *   "/auth/logout",
 *   "/auth/change-password"
 * ]
 *
 * Save karein aur server restart karein - Done! ✅
 */
