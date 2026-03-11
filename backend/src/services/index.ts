/**
 * Services Index - Export all services
 */

export { AuthService, AuthError, authService } from './auth.service';
export { UserService, UserError, userService } from './user.service';
export { StudentService, StudentError, studentService } from './student.service';
export { SchoolService, SchoolError, schoolService } from './school.service';
export { TeacherService, TeacherError, teacherService } from './teacher.service';
export { ActivityService, ActivityError, activityService } from './activity.service';
export { ChallengeService, ChallengeError, challengeService } from './challenge.service';
export { AuditLogService, AuditLogError, auditLogService } from './auditLog.service';
export { ArticleService, ArticleError, articleService } from './article.service';
export { LevelService, LevelError, levelService } from './level.service';
export { NotificationService, NotificationError, notificationService } from './notification.service';
export {
  TeacherAnalyticsService,
  teacherAnalyticsService,
  type TeacherAnalyticsRange,
} from './teacherAnalytics.service';
export { default as jobTitleService } from './jobTitle.service';
export { PushService, pushService } from './push.service';
