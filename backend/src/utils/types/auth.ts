export type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role?: string;
  is_verified?: boolean;
  is_active?: boolean;
  school_id?: number | null;
  avatar_url?: string | null;
  password_hash?: string;
  email_verified?: boolean;
  role_id?: number;
  social_id?: string;
  is_deleted?: boolean;
  [key: string]: unknown;
};

export type UserData = {
  username: string;
  email: string;
  password: string;
};
