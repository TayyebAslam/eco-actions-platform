export enum ModuleKey {
  // Platform-level modules
  SCHOOLS = "schools",
  SCHOOL_REQUESTS = "school_requests",
  SYSTEM_USERS = "super_sub_admins", // System users module (manages both super sub-admins and sub-admins)
  PLATFORM_REPORTS = "platform_reports",
  ADMINS = "admins", // School admins module (manages admin and sub-admin users)

  // School-level modules
  STUDENTS = "students",
  TEACHERS = "teachers",
  CATEGORIES = "categories",
  ACTIVITIES = "activities",
  CHALLENGES = "challenges",
  ARTICLES = "articles",
  BADGES = "badges",
  LEVELS = "levels",
}

export enum PermissionAction {
  CREATE = "can_create",
  READ = "can_read",
  EDIT = "can_edit",
  DELETE = "can_delete",
}
