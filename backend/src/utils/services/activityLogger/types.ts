export type LogChannel = "single" | "daily" | "db";

export type ActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "LOGIN"
  | "LOGOUT"
  | "APPROVE"
  | "REJECT"
  | "EXPORT"
  | "IMPORT"
  | "TOGGLE_STATUS"
  | "ASSIGN"
  | "REMOVE"
  | "PASSWORD_CHANGE"
  | "EMAIL_CHANGE"
  | "PERMISSION_UPDATE"
  | "BULK_DELETE"
  | "BULK_UPDATE";

export type ModuleType =
  | "auth"
  | "users"
  | "admins"
  | "students"
  | "teachers"
  | "schools"
  | "school_requests"
  | "system_users"
  | "categories"
  | "activities"
  | "challenges"
  | "badges"
  | "levels"
  | "articles"
  | "classes"
  | "sections"
  | "roles"
  | "permissions"
  | "profile"
  | "sessions";

export interface ActivityLogEntry {
  timestamp: string;
  user_id: number | null;
  user_email: string | null;
  role: string | null;
  school_id?: number | null;
  action: ActionType;
  module: ModuleType;
  resource_id?: number | string | null;
  resource_name?: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details?: Record<string, unknown>;
  status: "success" | "failure";
  error_message?: string;
}

export interface ActivityLogConfig {
  enabled: boolean;
  channel: LogChannel;
  dailyRetentionDays: number;
  logPath: string;
}

export interface LogChannelInterface {
  write(entry: ActivityLogEntry): Promise<void>;
  cleanup?(): Promise<void>;
}
