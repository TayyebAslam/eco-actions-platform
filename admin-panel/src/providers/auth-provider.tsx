"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { User, PermissionsMap } from "@/types";
import { authApi, profileApi } from "@/lib/api";
import { z } from "zod";

// Security: Validate user data before storing in localStorage
const permissionSetSchema = z.object({
  can_create: z.boolean(),
  can_read: z.boolean(),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
});

const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  avatar_url: z.string().nullable().optional(),
  role: z.enum(["super_admin", "super_sub_admin", "admin", "school_admin", "sub_admin", "teacher", "student"]),
  is_active: z.boolean(),
  created_at: z.string().optional(),
  permissions: z.record(z.string(), permissionSetSchema).optional().nullable(),
  school_id: z.number().nullish(),
  job_title_id: z.number().nullish(),
  job_title_name: z.string().nullish(),
});

// Security: Safely parse and validate user data
const validateUserData = (data: unknown): User | null => {
  try {
    return userSchema.parse(data) as User;
  } catch (error) {
    console.error("Invalid user data structure:", error);
    return null;
  }
};

// Security: Safely parse JSON from localStorage
const safeParseStoredUser = (storedUser: string | null): User | null => {
  if (!storedUser) return null;
  try {
    const parsed = JSON.parse(storedUser);
    return validateUserData(parsed);
  } catch {
    return null;
  }
};
export interface PermissionUpdatePayload {
  module_id: number;
  module_key: string;
  can_create: boolean;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updatePermissions: (permissions: PermissionUpdatePayload[]) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const validateSession = async () => {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        setIsLoading(false);
        return;
      }

      try {
        // Validate session with backend
        const response = await authApi.checkSession();
        const userData = response.data.data;

        // Security: Validate user data structure before storing
        const validatedUser = validateUserData(userData);
        if (!validatedUser) {
          throw new Error("Invalid user data from server");
        }

        setUser(validatedUser);
        localStorage.setItem("user", JSON.stringify(validatedUser));
      } catch (error: any) {
        // If endpoint doesn't exist (404), use stored user data as fallback
        if (error.response?.status === 404) {
          // Security: Validate stored user data
          const validatedUser = safeParseStoredUser(storedUser);
          if (validatedUser) {
            setUser(validatedUser);
          } else {
            localStorage.removeItem("user");
            setUser(null);
            router.push("/auth/login");
          }
        } else {
          // For 401/403 or other errors, session is invalid - clear and redirect
          console.error("Session validation failed:", error);
          localStorage.removeItem("user");
          setUser(null);
          router.push("/auth/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
  }, [router]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    const {
      user: userData,
      requiresSchoolSetup,
      schoolRequestStatus,
      rejectionReason,
      reregistrationToken,
    } = response.data.data;

    // Security: Validate user data before storing
    const validatedUser = validateUserData(userData);
    if (!validatedUser) {
      throw new Error("Invalid user data received from server");
    }

    localStorage.setItem("user", JSON.stringify(validatedUser));
    setUser(validatedUser);
    // Clear any stale query cache from previous session so components fetch fresh data
    try {
      queryClient.clear();
    } catch (e) {
      // ignore
    }

    // Handle different school registration statuses
    if (schoolRequestStatus === "rejected") {
      // Store rejection info in sessionStorage for reregister page
      sessionStorage.setItem("rejectionReason", rejectionReason || "");
      sessionStorage.setItem("reregistrationToken", reregistrationToken || "");
      sessionStorage.setItem("adminEmail", userData.email);
      router.push("/auth/reregister-school");
    } else if (requiresSchoolSetup) {
      router.push("/auth/school-setup");
    } else {
      router.push("/dashboard");
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue with logout even if API fails
    } finally {
      // Cancel any ongoing queries and clear cache to avoid showing stale data
      try {
        await queryClient.cancelQueries();
      } catch (e) {
        // ignore
      }
      queryClient.clear();

      // Tokens are handled via httpOnly cookies (cleared by backend)
      localStorage.removeItem("user");
      setUser(null);
      router.push("/auth/login");
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      const updatedUser = { ...prevUser, ...userData };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const updatePermissions = useCallback((permissions: PermissionUpdatePayload[]) => {
    setUser((prevUser) => {
      if (!prevUser) {
        return prevUser;
      }

      // Convert array to PermissionsMap
      const permissionsMap: PermissionsMap = {};
      permissions.forEach((p) => {
        permissionsMap[p.module_key] = {
          can_create: p.can_create,
          can_read: p.can_read,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        };
      });

      const updatedUser = { ...prevUser, permissions: permissionsMap };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const refreshUser = async () => {
    try {
      const response = await profileApi.get();
      const userData = response.data.data;

      // Security: Validate user data before storing
      const validatedUser = validateUserData(userData);
      if (!validatedUser) {
        throw new Error("Invalid user data");
      }

      localStorage.setItem("user", JSON.stringify(validatedUser));
      setUser(validatedUser);
    } catch {
      // If refresh fails, log out the user
      await logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
        updatePermissions,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
