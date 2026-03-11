"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn, validatePassword } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Leaf,
  Loader2,
  TreePine,
  Recycle,
  Sun,
  Droplets,
  Wind,
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  KeyRound,
  CheckCircle2,
  XCircle,
  School,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "login" | "forgot-password" | "reset-password" | "signup";

const LOGIN_RATE_LIMIT_STORAGE_KEY =
  process.env.NEXT_PUBLIC_LOGIN_RATE_LIMIT_KEY || "eco-actions_login_cooldown";

const getRemainingSeconds = (endsAt: number) =>
  Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));

const formatCountdown = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getPasswordValidationError = (value: string) => {
  if (value.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/\d/.test(value)) {
    return "Password must contain at least one number";
  }
  if (!/[@$!%*?&#]/.test(value)) {
    return "Password must contain at least one special character (@, $, !, %, *, ?, &, #)";
  }
  return null;
};

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for encrypted reset data in URL
  const resetData = searchParams.get("data");

  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginCooldownSeconds, setLoginCooldownSeconds] = useState(0);
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const setLoginCooldown = (seconds: number) => {
    // UX-only client hint; backend 429 rate-limits are the actual security control.
    const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
    const endsAt = Date.now() + safeSeconds * 1000;
    localStorage.setItem(LOGIN_RATE_LIMIT_STORAGE_KEY, String(endsAt));
    setLoginCooldownSeconds(safeSeconds);
  };

  // Redirect authenticated users (only on initial load, not after login)
  // Login redirect is handled by auth-provider
  useEffect(() => {
    // Only redirect if user was already authenticated when page loaded
    // Don't interfere with login redirect logic
    const storedUser = localStorage.getItem("user");
    if (!authLoading && isAuthenticated && storedUser) {
      const user = JSON.parse(storedUser);
      // If admin without school, go to school setup
      if (user.role === "admin" && !user.school_id) {
        router.push("/auth/school-setup");
      } else {
        router.push("/dashboard");
      }
    }
  }, []);

  // Auto-switch to reset-password mode and verify token if present
  useEffect(() => {
    const verifyToken = async () => {
      if (resetData) {
        setViewMode("reset-password");

        // Verify if token is still valid
        try {
          await authApi.verifyResetToken(resetData);
          // Token is valid, show reset form
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } };
          const errorMessage =
            err.response?.data?.message || "Invalid or expired reset link";
          setResetError(errorMessage);
        }
      }
    };

    verifyToken();
  }, [resetData]);

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForgotPasswordForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateResetPasswordForm = () => {
    const newErrors: Record<string, string> = {};

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.error;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Restore persisted login cooldown on page load
  useEffect(() => {
    const storedEndsAt = Number(localStorage.getItem(LOGIN_RATE_LIMIT_STORAGE_KEY));
    if (!Number.isFinite(storedEndsAt) || storedEndsAt <= 0) {
      localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
      return;
    }

    const remaining = getRemainingSeconds(storedEndsAt);
    if (remaining > 0) {
      setLoginCooldownSeconds(remaining);
    } else {
      localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
    }
  }, []);

  // Tick countdown while rate-limited and clear persistence when done
  useEffect(() => {
    if (loginCooldownSeconds <= 0) return;

    const intervalId = window.setInterval(() => {
      const storedEndsAt = Number(localStorage.getItem(LOGIN_RATE_LIMIT_STORAGE_KEY));
      if (!Number.isFinite(storedEndsAt) || storedEndsAt <= 0) {
        setLoginCooldownSeconds(0);
        localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
        window.clearInterval(intervalId);
        return;
      }

      const remaining = getRemainingSeconds(storedEndsAt);
      if (remaining <= 0) {
        setLoginCooldownSeconds(0);
        localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
        window.clearInterval(intervalId);
      } else {
        setLoginCooldownSeconds(remaining);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [loginCooldownSeconds > 0]);

  // Keep cooldown synced if localStorage changes in another tab
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LOGIN_RATE_LIMIT_STORAGE_KEY) return;
      const endsAt = Number(event.newValue);
      if (!Number.isFinite(endsAt) || endsAt <= 0) {
        setLoginCooldownSeconds(0);
        return;
      }
      setLoginCooldownSeconds(getRemainingSeconds(endsAt));
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateLoginForm()) {
      return;
    }


    if (loginCooldownSeconds > 0) {
      toast.error(
        `Too many attempts. Please try again in ${formatCountdown(loginCooldownSeconds)}.`,
      );
      return;
    }

    setIsLoading(true);

    try {
      // Use auth context login directly - it handles everything
      await login(email, password);
      localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
      setLoginCooldownSeconds(0);
      toast.success("Login successful!");
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number;
          headers?: Record<string, string | number | undefined>;
          data?: {
            message?: string;
            requiresEmailVerification?: boolean;
            schoolRequestStatus?: string;
            retryAfter?: number | string;
            status?: number;
            success?: boolean;
            data?: {
              retryAfter?: number | string;
            };
          };
        };
      };

      const retryAfterFromPayload =
        err?.response?.data?.retryAfter ??
        err?.response?.data?.data?.retryAfter ??
        err?.response?.headers?.["retry-after"];
      const retryAfterFromMessage = err?.response?.data?.message?.match(/(\d+)\s*seconds?/i)?.[1];
      const retryAfter = Number(retryAfterFromPayload ?? retryAfterFromMessage);

      if (err.response?.status === 429 || err.response?.data?.status === 429) {

        setLoginCooldown(retryAfter > 0 ? retryAfter : 60);
        toast.error(
          err.response?.data?.message ||
            "Too many authentication attempts. Please try again shortly.",
        );
        return;
      }

      // Check for pending school registration
      if (err.response?.data?.schoolRequestStatus === "pending") {
        toast.info(
          err.response?.data?.message ||
            "Your school registration is pending approval.",
        );
        setIsLoading(false);
        return;
      }

      if (err.response?.data?.requiresEmailVerification) {
        toast.error("Please verify your email before logging in.");
      } else {
        toast.error(err.response?.data?.message || "Invalid credentials");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForgotPasswordForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setEmailSent(true);
      toast.success("Password reset email sent!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateResetPasswordForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await authApi.resetPassword({
        data: resetData!,
        password,
      });
      setResetSuccess(true);
      toast.success("Password reset successfully!");
      // Clear URL params
      router.replace("/auth/login");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage =
        err.response?.data?.message || "Failed to reset password";
      // Show error UI instead of just toast for token-related errors
      setResetError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateSignupForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await authApi.adminSignup({
        first_name: firstName,
        last_name: lastName,
        email,
        password,
      });
      setSignupEmailSent(true);
      toast.success("Account created! Please check your email to verify.");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  const switchToLogin = () => {
    setViewMode("login");
    setEmailSent(false);
    setResetSuccess(false);
    setResetError(null);
    setSignupEmailSent(false);
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setFirstName("");
    setLastName("");
    // Clear URL params if present
    if (resetData) {
      router.replace("/auth/login");
    }
  };

  const switchToForgotPassword = () => {
    setViewMode("forgot-password");
    setEmailSent(false);
    setErrors({});
  };

  const switchToSignup = () => {
    setViewMode("signup");
    setSignupEmailSent(false);
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setFirstName("");
    setLastName("");
    setErrors({});
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex overflow-x-hidden overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:w-[55%] relative bg-gradient-to-br from-emerald-600 via-green-500 to-teal-600">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 login-background-pattern" />
        </div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-400/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-400/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-green-300/20 rounded-full blur-2xl" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Eco Actions</span>
          </div>

          {/* Middle - Main Content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Empowering the Next Generation of{" "}
              <span className="text-emerald-200">Eco-Warriors</span>
            </h1>
            <p className="text-lg text-white/80 mb-10 leading-relaxed">
              Gamify sustainability education. Track eco-friendly actions. Build
              a greener future together with schools and students.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-2 gap-4">
              <FeatureCard
                icon={<TreePine className="h-5 w-5" />}
                title="Track Actions"
                desc="Monitor eco activities"
              />
              <FeatureCard
                icon={<Recycle className="h-5 w-5" />}
                title="Earn Rewards"
                desc="Points & badges"
              />
              <FeatureCard
                icon={<Sun className="h-5 w-5" />}
                title="Learn & Grow"
                desc="Educational content"
              />
              <FeatureCard
                icon={<Wind className="h-5 w-5" />}
                title="Compete"
                desc="Leaderboards & challenges"
              />
            </div>
          </div>

          {/* Bottom - Stats */}
          <div className="flex items-center gap-8  mt-2 pt-6 border-t border-white/20">
            <StatItem value="10K+" label="Students" />
            <StatItem value="500+" label="Schools" />
            <StatItem value="50K+" label="Eco Actions" />
            <StatItem value="100+" label="Challenges" />
          </div>
        </div>

        {/* Floating Elements - Positioned in corners */}
        <div className="absolute top-24 right-12 animate-float opacity-60">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20">
            <Droplets className="h-8 w-8 text-blue-200" />
          </div>
        </div>
        <div className="absolute bottom-32 right-24 animate-float-delayed opacity-60">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
            <Leaf className="h-6 w-6 text-green-200" />
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[420px]">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                  <Leaf className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Eco Actions</span>
              </div>
              <p className="text-gray-500 text-sm">Sustainability Ecosystem</p>
            </div>

            {/* Auth Card */}
            <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
              {viewMode === "login" ? (
                <>
                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                      <Leaf className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      Welcome Back
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-1">
                      Sign in to access your admin dashboard
                    </CardDescription>
                    {loginCooldownSeconds > 0 && (
                      <p role="alert" className="mt-2 text-sm text-amber-600 font-medium">
                        Too many login attempts. Please try again in{" "}
                        {formatCountdown(loginCooldownSeconds)}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label
                          htmlFor="email"
                          className="text-gray-700 font-medium"
                        >
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="admin@eco-actions.com"
                          value={email}
                          onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) {
                            setErrors(prev => ({ ...prev, email: "" }));
                          }
                          }}
                          disabled={isLoading}
                          maxLength={255}
                          className={`h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${
                          errors.email ? "border-red-500" : ""
                        }`}
                        />
                      {errors.email && (
                        <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                      )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label
                            htmlFor="password"
                            className="text-gray-700 font-medium"
                          >
                            Password
                          </Label>
                          <button
                            type="button"
                            onClick={switchToForgotPassword}
                            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) {
                              setErrors(prev => ({ ...prev, password: "" }));
                            }
                            }}
                            disabled={isLoading}
                            maxLength={128}
                            className={`h-12 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${
                            errors.password ? "border-red-500" : ""
                          }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      {errors.password && (
                        <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                      )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                        disabled={isLoading || loginCooldownSeconds > 0}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-4 text-gray-400">or</span>
                      </div>
                    </div>

                    {/* Register School Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={switchToSignup}
                      className="w-full h-12 bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-800 font-semibold transition-all duration-300 rounded-xl text-base"
                    >
                      <School className="mr-2 h-5 w-5" />
                      Register Your School
                    </Button>

                
                  </CardContent>
                </>
              ) : viewMode === "signup" ? (
                <>
                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                      {signupEmailSent ? (
                        <CheckCircle2 className="h-8 w-8 text-white" />
                      ) : (
                        <UserPlus className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {signupEmailSent
                        ? "Verify Your Email"
                        : "Register Your School"}
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-1">
                      {signupEmailSent
                        ? "We've sent a verification link to your email"
                        : "Create your admin account to get started"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {signupEmailSent ? (
                      <div className="space-y-5">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                          <p className="text-emerald-700 text-sm">
                            A verification link has been sent to{" "}
                            <strong>{email}</strong>. Please check your inbox
                            and click the link to verify your email.
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 text-center">
                          After verifying your email, you can log in and
                          complete your school registration.
                        </p>
                        <Button
                          type="button"
                          onClick={switchToLogin}
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                        >
                          <ArrowLeft className="mr-2 h-5 w-5" />
                          Back to Login
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleAdminSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label
                              htmlFor="firstName"
                              className="text-gray-700 font-medium"
                            >
                              First Name
                            </Label>
                            <Input
                              id="firstName"
                              type="text"
                              placeholder="John"
                              value={firstName}
                              onChange={(e) => {
                              setFirstName(e.target.value);
                              if (errors.firstName) {
                                setErrors(prev => ({ ...prev, firstName: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={50}
                              className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                              errors.firstName ? "border-red-500" : ""
                            }`}
                            />
                          {errors.firstName && (
                            <p className="text-sm text-red-500 mt-1">{errors.firstName}</p>
                          )}
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="lastName"
                              className="text-gray-700 font-medium"
                            >
                              Last Name
                            </Label>
                            <Input
                              id="lastName"
                              type="text"
                              placeholder="Doe"
                              value={lastName}
                              onChange={(e) => {
                              setLastName(e.target.value);
                              if (errors.lastName) {
                                setErrors(prev => ({ ...prev, lastName: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={50}
                              className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                              errors.lastName ? "border-red-500" : ""
                            }`}
                            />
                          {errors.lastName && (
                            <p className="text-sm text-red-500 mt-1">{errors.lastName}</p>
                          )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="signup-email"
                            className="text-gray-700 font-medium"
                          >
                            Email Address
                          </Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="admin@school.com"
                            value={email}
                            onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) {
                              setErrors(prev => ({ ...prev, email: "" }));
                            }
                            }}
                            disabled={isLoading}
                            maxLength={255}
                            className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                            errors.email ? "border-red-500" : ""
                          }`}
                          />
                        {errors.email && (
                          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                        )}
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="signup-password"
                            className="text-gray-700 font-medium"
                          >
                            Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="signup-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Min 8 chars, uppercase, number, special"
                              value={password}
                              onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) {
                                setErrors(prev => ({ ...prev, password: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={128}
                              className={`h-11 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                              errors.password ? "border-red-500" : ""
                            }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              disabled={isLoading}
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        {errors.password && (
                          <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                        )}
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="signup-confirm-password"
                            className="text-gray-700 font-medium"
                          >
                            Confirm Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="signup-confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              value={confirmPassword}
                              onChange={(e) =>
                                {
                              setConfirmPassword(e.target.value)
                              ;
                              if (errors.confirmPassword) {
                                setErrors(prev => ({ ...prev, confirmPassword: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={128}
                              className={`h-11 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                              errors.confirmPassword ? "border-red-500" : ""
                            }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              disabled={isLoading}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        {errors.confirmPassword && (
                          <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                        )}
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base mt-2"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            "Create Account"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={switchToLogin}
                          className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Login
                        </button>
                      </form>
                    )}
                  </CardContent>
                </>
              ) : viewMode === "forgot-password" ? (
                <>
                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                      <Mail className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {emailSent ? "Check Your Email" : "Forgot Password?"}
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-1">
                      {emailSent
                        ? "We've sent a password reset link to your email"
                        : "Enter your email to receive a reset link"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {emailSent ? (
                      <div className="space-y-5">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                          <p className="text-emerald-700 text-sm">
                            A password reset link has been sent to{" "}
                            <strong>{email}</strong>. Please check your inbox
                            and follow the instructions.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={switchToLogin}
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                        >
                          <ArrowLeft className="mr-2 h-5 w-5" />
                          Back to Login
                        </Button>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleForgotPassword}
                        className="space-y-5"
                      >
                        <div className="space-y-2">
                          <Label
                            htmlFor="forgot-email"
                            className="text-gray-700 font-medium"
                          >
                            Email Address
                          </Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="admin@eco-actions.com"
                            value={email}
                            onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) {
                              setErrors(prev => ({ ...prev, email: "" }));
                            }
                            }}
                            disabled={isLoading}
                            maxLength={255}
                            className={`h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${
                            errors.email ? "border-red-500" : ""
                          }`}
                          />
                        {errors.email && (
                          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                        )}
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Reset Link"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={switchToLogin}
                          className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Login
                        </button>
                      </form>
                    )}
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader className="text-center pb-4 pt-8">
                    <div
                      className={cn(
                        "mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl",
                        resetError
                          ? "bg-destructive/15 shadow-destructive/30"
                          : resetSuccess
                            ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30"
                            : "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30",
                      )}
                    >
                      {resetError ? (
                        <XCircle className="h-8 w-8 text-destructive" />
                      ) : resetSuccess ? (
                        <CheckCircle2 className="h-8 w-8 text-white" />
                      ) : (
                        <KeyRound className="h-8 w-8 text-white" />
                      )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-900">
                      {resetError
                        ? "Link Invalid"
                        : resetSuccess
                          ? "Password Reset!"
                          : "Reset Password"}
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-1">
                      {resetError
                        ? resetError
                        : resetSuccess
                          ? "Your password has been successfully reset"
                          : "Enter your new password"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-8 pb-8">
                    {resetError ? (
                      <Button
                        type="button"
                        onClick={switchToLogin}
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                      >
                        <ArrowLeft className="mr-2 h-5 w-5" />
                        Back to Login
                      </Button>
                    ) : resetSuccess ? (
                      <Button
                        type="button"
                        onClick={switchToLogin}
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                      >
                        Continue to Login
                      </Button>
                    ) : (
                      <form
                        onSubmit={handleResetPassword}
                        className="space-y-5"
                      >
                        <div className="space-y-2">
                          <Label
                            htmlFor="new-password"
                            className="text-gray-700 font-medium"
                          >
                            New Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter new password"
                              value={password}
                              onChange={(e) => {
                              setPassword(e.target.value);
                              if (errors.password) {
                                setErrors(prev => ({ ...prev, password: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={128}
                              className={`h-12 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${
                              errors.password ? "border-red-500" : ""
                            }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        {errors.password && (
                          <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                        )}
                        </div>
                        <div className="space-y-2">
                          <Label
                            htmlFor="confirm-password"
                            className="text-gray-700 font-medium"
                          >
                            Confirm Password
                          </Label>
                          <div className="relative">
                            <Input
                              id="confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm new password"
                              value={confirmPassword}
                              onChange={(e) =>
                                {
                              setConfirmPassword(e.target.value)
                              ;
                              if (errors.confirmPassword) {
                                setErrors(prev => ({ ...prev, confirmPassword: "" }));
                              }
                              }}
                              disabled={isLoading}
                              maxLength={128}
                              className={`h-12 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${
                              errors.confirmPassword ? "border-red-500" : ""
                            }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        {errors.confirmPassword && (
                          <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                        )}
                        </div>
                        <Button
                          type="submit"
                          className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Resetting...
                            </>
                          ) : (
                            "Reset Password"
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={switchToLogin}
                          className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 font-medium transition-colors py-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Login
                        </button>
                      </form>
                    )}
                  </CardContent>
                </>
              )}
            </Card>

            <p className="mt-8 text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Eco Actions. Making the world
              greener.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 hover:bg-white/15 transition-colors">
      <div className="text-white/90 mb-2">{icon}</div>
      <h3 className="text-white font-semibold text-sm">{title}</h3>
      <p className="text-white/60 text-xs">{desc}</p>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-white/60">{label}</div>
    </div>
  );
}