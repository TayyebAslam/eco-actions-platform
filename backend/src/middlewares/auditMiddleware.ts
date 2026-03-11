import { Request, Response, NextFunction } from "express";
import { activityLogger, ActionType, ModuleType } from "../utils/services/activityLogger";

// Map HTTP methods to action types
const methodToAction: Record<string, ActionType> = {
  GET: "VIEW",
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

// Map route patterns to modules
const routeToModule: Record<string, ModuleType> = {
  "/student/challenges": "challenges",
  "/student/activities": "activities",
  "/student/articles": "articles",
  "/student/leaderboard": "students",
  "/student": "students",
  "/teacher/activities": "activities",
  "/teacher/users": "teachers",
  "/teacher": "teachers",
  "/admin/students": "students",
  "/admin/teachers": "teachers",
  "/admin/admins": "admins",
  "/admin/schools": "schools",
  "/admin/school-requests": "school_requests",
  "/admin/system-users": "system_users",
  "/admin/categories": "categories",
  "/admin/activities": "activities",
  "/admin/challenges": "challenges",
  "/admin/badges": "badges",
  "/admin/levels": "levels",
  "/admin/articles": "articles",
  "/admin/classes": "classes",
  "/admin/sections": "sections",
  "/admin/roles": "roles",
  "/admin/permissions": "permissions",
  "/auth/login": "auth",
  "/auth/logout": "auth",
};

// Get module from path
const getModuleFromPath = (path: string): ModuleType | null => {
  for (const [route, module] of Object.entries(routeToModule)) {
    if (path.includes(route)) {
      return module;
    }
  }
  return null;
};

// Get resource ID from path (e.g., /admin/students/123 -> 123)
const getResourceIdFromPath = (path: string): string | null => {
  const parts = path.split("/");
  const lastPart = parts[parts.length - 1] ?? "";
  // Check if last part is a number
  if (/^\d+$/.test(lastPart)) {
    return lastPart;
  }
  return null;
};

// Get action override for special routes
const getActionOverride = (path: string, method: string): ActionType | null => {
  if (path.includes("/toggle-status") || path.includes("/toggle")) {
    return "TOGGLE_STATUS";
  }
  if (path.includes("/approve")) {
    return "APPROVE";
  }
  if (path.includes("/reject")) {
    return "REJECT";
  }
  if (path.includes("/permissions") && method === "PUT") {
    return "PERMISSION_UPDATE";
  }
  if (path.includes("/login")) {
    return "LOGIN";
  }
  if (path.includes("/logout")) {
    return "LOGOUT";
  }
  if (path.includes("/password")) {
    return "PASSWORD_CHANGE";
  }
  return null;
};

/**
 * Audit Logging Middleware
 * Automatically logs API actions to activity logs
 */
export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const path = req.originalUrl || req.path;

  // Skip non-business request methods
  if (req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  // Keep admin/auth read operations excluded, but include student/teacher GET logs
  const isStudentOrTeacherRoute = path.includes("/student/") || path.includes("/teacher/");
  if (req.method === "GET" && !isStudentOrTeacherRoute) {
    return next();
  }

  const originalSend = res.send;
  const module = getModuleFromPath(path);

  // Skip if module not recognized
  if (!module) {
    return next();
  }

  // Override res.send to log after response
  res.send = function (body: unknown): Response {
    // Parse response to check status
    let responseData: Record<string, unknown> = {};
    try {
      responseData = typeof body === "string" ? JSON.parse(body) : (body as Record<string, unknown>);
    } catch (e) {
      // Not JSON, ignore
    }

    const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
    const action = getActionOverride(path, req.method) || methodToAction[req.method] || "UPDATE";
    const resourceId = getResourceIdFromPath(path);

    // Get resource name from request body or response
    let resourceName: string | null = null;
    if (req.body?.name) {
      resourceName = req.body.name;
    } else if (req.body?.first_name && req.body?.last_name) {
      resourceName = `${req.body.first_name} ${req.body.last_name}`;
    } else if (req.body?.email) {
      resourceName = req.body.email;
    } else if (req.body?.title) {
      resourceName = req.body.title;
    }

    // Log the action asynchronously (don't block response)
    setImmediate(() => {
      // Skip if the controller already logged this request explicitly
      if ((req as unknown as Record<string, unknown>)._auditLogged) return;

      activityLogger.log(req, action, module, {
        resourceId,
        resourceName,
        status: isSuccess ? "success" : "failure",
        errorMessage: !isSuccess ? (responseData?.message as string | undefined) : undefined,
        details: {
          path,
          method: req.method,
          statusCode: res.statusCode,
        },
      }).catch((err) => {
        console.error("Audit logging failed:", err);
      });
    });

    return originalSend.call(this, body);
  };

  next();
};
