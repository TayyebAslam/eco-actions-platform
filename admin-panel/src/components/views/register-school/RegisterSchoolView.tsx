"use client";

import { validatePassword } from "@/lib/utils";
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
  Wind,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { schoolRequestsApi } from "@/lib/api";
import { useState } from "react";

export function RegisterSchoolView() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Admin form data only (Step 1)
  const [formData, setFormData] = useState({
    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    admin_password: "",
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.admin_first_name.trim()) {
      newErrors.admin_first_name = "First name is required";
    }

    if (!formData.admin_last_name.trim()) {
      newErrors.admin_last_name = "Last name is required";
    }

    if (!formData.admin_email.trim()) {
      newErrors.admin_email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email.trim())) {
      newErrors.admin_email = "Please enter a valid email address";
    }

    if (!formData.admin_password) {
      newErrors.admin_password = "Password is required";
    } else {
      const passwordValidation = validatePassword(formData.admin_password);
      if (!passwordValidation.isValid) {
        newErrors.admin_password = passwordValidation.error;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await schoolRequestsApi.initiate({
        admin_email: formData.admin_email,
        admin_first_name: formData.admin_first_name,
        admin_last_name: formData.admin_last_name,
        admin_password: formData.admin_password,
      });

      setSubmittedEmail(formData.admin_email);
      setIsSubmitted(true);
      toast.success("Verification email sent!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message ||
          "Failed to submit registration. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Email sent success screen
  if (isSubmitted) {
    return (
      <div className="h-screen flex overflow-hidden">
        {/* Left Side - Decorative */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-500 to-teal-600">
          <div className="absolute inset-0 opacity-30">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-400/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-400/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

          <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Thrive</span>
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
                Almost There!{" "}
                <span className="text-emerald-200">Check Your Email</span>
              </h1>
              <p className="text-lg text-white/80 mb-10 leading-relaxed">
                We&apos;ve sent a verification link to your email. Click it to
                continue with your school registration.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">
                    Create your admin account
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <span className="text-white font-medium">Verify your email</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <span className="text-white/70">Add school details</span>
                </div>
              </div>

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

            <div className="flex items-center gap-8 pt-8 border-t border-white/20">
              <StatItem value="10K+" label="Students" />
              <StatItem value="500+" label="Schools" />
              <StatItem value="50K+" label="Eco Actions" />
            </div>
          </div>
        </div>

        {/* Right Side - Email Sent Card */}
        <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                  <Leaf className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Thrive</span>
              </div>
              <p className="text-gray-500 text-sm">Check Your Email</p>
            </div>

            <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Check Your Email
                </CardTitle>
                <CardDescription className="text-gray-500 mt-1">
                  Verification link sent to your inbox
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center mb-6">
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    We&apos;ve sent a verification email to{" "}
                    <strong>{submittedEmail}</strong>. Please click the link in
                    the email to continue with your school registration.
                  </p>
                </div>
                <p className="text-sm text-gray-500 text-center mb-6">
                  The link will expire in 24 hours. If you don&apos;t see the email,
                  please check your spam folder.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      setIsSubmitted(false);
                      setFormData({
                        admin_first_name: "",
                        admin_last_name: "",
                        admin_email: "",
                        admin_password: "",
                      });
                    }}
                    variant="outline"
                    className="w-full h-12 rounded-xl text-base"
                  >
                    Use Different Email
                  </Button>
                  <Link href="/auth/login">
                    <Button
                      variant="ghost"
                      className="w-full h-12 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl text-base"
                    >
                      Back to Login
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <p className="mt-8 text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Thrive. Making the world greener.
            </p>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Decorative */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-500 to-teal-600">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-400/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-teal-400/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Thrive</span>
          </div>

          {/* Middle - Main Content */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Join the{" "}
              <span className="text-emerald-200">Sustainability Revolution</span>
            </h1>
            <p className="text-lg text-white/80 mb-10 leading-relaxed">
              Register your school with Thrive and start empowering students to
              make a positive environmental impact through gamified learning.
            </p>

            {/* Steps indicator */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <span className="text-white font-medium">
                  Create your admin account
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <span className="text-white/70">Verify your email</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <span className="text-white/70">Add school details</span>
              </div>
            </div>

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
          <div className="flex items-center gap-8 pt-8 border-t border-white/20">
            <StatItem value="10K+" label="Students" />
            <StatItem value="500+" label="Schools" />
            <StatItem value="50K+" label="Eco Actions" />
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                <Leaf className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Thrive</span>
            </div>
            <p className="text-gray-500 text-sm">Register Your School</p>
          </div>

          {/* Registration Card */}
          <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Step 1: Create Account
              </CardTitle>
              <CardDescription className="text-gray-500 mt-1">
                Enter your admin details to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="admin_first_name" className="text-gray-700">
                      First Name *
                    </Label>
                    <Input
                      id="admin_first_name"
                      value={formData.admin_first_name}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          admin_first_name: e.target.value,
                        });
                        if (errors.admin_first_name) {
                          setErrors(prev => ({ ...prev, admin_first_name: "" }));
                        }
                      }}
                      placeholder="John"
                      disabled={isLoading}
                      className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                        errors.admin_first_name ? "border-red-500" : ""
                      }`}
                    />
                    {errors.admin_first_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin_first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_last_name" className="text-gray-700">
                      Last Name *
                    </Label>
                    <Input
                      id="admin_last_name"
                      value={formData.admin_last_name}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          admin_last_name: e.target.value,
                        });
                        if (errors.admin_last_name) {
                          setErrors(prev => ({ ...prev, admin_last_name: "" }));
                        }
                      }}
                      placeholder="Doe"
                      disabled={isLoading}
                      className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                        errors.admin_last_name ? "border-red-500" : ""
                      }`}
                    />
                    {errors.admin_last_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin_last_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_email" className="text-gray-700">
                    Email Address *
                  </Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={formData.admin_email}
                    onChange={(e) => {
                      setFormData({ ...formData, admin_email: e.target.value });
                      if (errors.admin_email) {
                        setErrors(prev => ({ ...prev, admin_email: "" }));
                      }
                    }}
                    placeholder="admin@school.com"
                    disabled={isLoading}
                    className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                      errors.admin_email ? "border-red-500" : ""
                    }`}
                  />
                  {errors.admin_email && (
                    <p className="text-sm text-red-500 mt-1">{errors.admin_email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_password" className="text-gray-700">
                    Password *
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin_password"
                      type={showPassword ? "text" : "password"}
                      value={formData.admin_password}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          admin_password: e.target.value,
                        });
                        if (errors.admin_password) {
                          setErrors(prev => ({ ...prev, admin_password: "" }));
                        }
                      }}
                      placeholder="Minimum 8 characters"
                      disabled={isLoading}
                      className={`h-11 pr-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${
                        errors.admin_password ? "border-red-500" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
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
                  {errors.admin_password && (
                    <p className="text-sm text-red-500 mt-1">{errors.admin_password}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base mt-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending verification...
                    </>
                  ) : (
                    "Continue & Verify Email"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-500 mt-4">
                  Already have an account?{" "}
                  <Link
                    href="/auth/login"
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Sign In
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>


          <p className="mt-8 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Thrive. Making the world greener.
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
