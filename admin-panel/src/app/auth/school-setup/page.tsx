"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { schoolsApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Leaf,
  Loader2,
  LogOut,
  School,
  Upload,
  TreePine,
  Recycle,
  Sun,
  Wind,
  Droplets,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function SchoolSetupPage() {
  const router = useRouter();
  const {
    user,
    logout,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    address: "",
  });

  const [schoolLogo, setSchoolLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if not authenticated or already has school (but not if submitted)
  useEffect(() => {
    if (!authLoading && !isSubmitted) {
      if (!isAuthenticated) {
        router.push("/auth/login");
      } else if (user?.school_id) {
        router.push("/dashboard");
      }
    }
  }, [authLoading, isAuthenticated, user, router, isSubmitted]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPG, PNG, or GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setSchoolLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Auto-generate slug from school name
  const handleSchoolNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    });
    // Clear name error when user types
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "School name is required";
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
      const data = new FormData();
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      if (formData.address) data.append("address", formData.address);
      if (schoolLogo) data.append("logo", schoolLogo);

      await schoolsApi.setup(data);

      toast.success("School registration submitted for approval!");
      // Clear auth state without redirect (we'll show success page)
      // Tokens are handled via httpOnly cookies (cleared by backend)
      localStorage.removeItem("user");
      setIsSubmitted(true);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message ||
          "Failed to register school. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Success screen after submission
  if (isSubmitted) {
    return (
      <div className="h-screen flex overflow-hidden relative">
        <TopRightLogoutButton logout={logout} />
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
                Almost There!{" "}
                <span className="text-emerald-200">Pending Approval</span>
              </h1>
              <p className="text-lg text-white/80 mb-10 leading-relaxed">
                Your school registration has been submitted successfully. Our
                team will review your request and notify you once it&apos;s
                approved.
              </p>

              {/* Steps indicator */}
              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">
                    Create admin account
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">
                    Verify email
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">
                    Submit school details
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-sm">
                    4
                  </div>
                  <span className="text-white font-medium">
                    Awaiting approval
                  </span>
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
            <div className="flex items-center gap-8 mt-2 pt-6 border-t border-white/20">
              <StatItem value="10K+" label="Students" />
              <StatItem value="500+" label="Schools" />
              <StatItem value="50K+" label="Eco Actions" />
              <StatItem value="100+" label="Challenges" />
            </div>
          </div>

          {/* Floating Elements */}
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

        {/* Right Side - Success Card */}
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
              <p className="text-gray-500 text-sm">Pending Approval</p>
            </div>

            {/* Success Card */}
            <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Registration Submitted!
                </CardTitle>
                <CardDescription className="text-gray-500 mt-1">
                  Your school registration is pending approval
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center mb-6">
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    Thank you for registering your school! Your request has been
                    received and is now pending approval from our admin team.
                  </p>
                </div>
                <p className="text-sm text-gray-500 text-center mb-6">
                  You will receive an email notification once your request has
                  been reviewed. This typically takes 1-2 business days.
                </p>
                <Link href="/auth/login">
                  <Button className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base">
                    Go to Login
                  </Button>
                </Link>
              </CardContent>
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

  return (
    <div className="h-screen flex overflow-hidden relative">
      <TopRightLogoutButton logout={logout} />
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
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-green-300/20 rounded-full blur-2xl" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
              Complete Your{" "}
              <span className="text-emerald-200">School Registration</span>
            </h1>
            <p className="text-lg text-white/80 mb-10 leading-relaxed">
              Add your school details to complete the registration. Once
              submitted, our team will review and approve your request.
            </p>

            {/* Steps indicator */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-white/70 line-through">
                  Create admin account
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-white/70 line-through">Verify email</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <span className="text-white font-medium">
                  Add school details
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <span className="text-white/70">Await approval</span>
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
          <div className="flex items-center gap-8 mt-2 pt-6 border-t border-white/20">
            <StatItem value="10K+" label="Students" />
            <StatItem value="500+" label="Schools" />
            <StatItem value="50K+" label="Eco Actions" />
            <StatItem value="100+" label="Challenges" />
          </div>
        </div>

        {/* Floating Elements */}
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

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center my-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                <Leaf className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Eco Actions</span>
            </div>
            <p className="text-gray-500 text-sm">Complete Your Registration</p>
          </div>

          {/* Registration Card */}
          <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                <School className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                School Details
              </CardTitle>
              <CardDescription className="text-gray-500 mt-1">
                Fill in your school information to complete registration
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700 font-medium">
                    School Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleSchoolNameChange(e.target.value)}
                    placeholder="Green Valley High School"
                    disabled={isLoading}
                    className={`h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl ${errors.name ? "border-red-500" : ""}`}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug" className="text-gray-700 font-medium">
                    Domain / Slug
                  </Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                    placeholder="green-valley-high-school"
                    disabled={isLoading}
                    className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl"
                  />
                  <p className="text-xs text-gray-500">
                    Auto-generated from school name. Used for URL.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">
                    School Logo
                  </Label>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 rounded-xl">
                      <AvatarImage
                        src={logoPreview || undefined}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-xl bg-emerald-50">
                        <School className="h-6 w-6 text-emerald-600" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoChange}
                        accept="image/jpeg,image/jpg,image/png,image/gif"
                        className="hidden"
                        disabled={isLoading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-xl"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </Button>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG or GIF. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="address"
                    className="text-gray-700 font-medium"
                  >
                    Address
                  </Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Eco Street, Green City"
                    rows={2}
                    disabled={isLoading}
                    className="h-[100px] resize-none overflow-y-auto bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl [scrollbar-color:#9ca3af_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-400 [&::-webkit-scrollbar-thumb]:rounded-full"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit for Approval"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>


          <p className="mt-8 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Eco Actions. Making the world greener.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}

function TopRightLogoutButton({ logout }: { logout: () => Promise<void> }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={logout}
      className="absolute right-1 top-1 z-50 bg-white/90 text-gray-700 border-gray-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-sm transition-all duration-300 ease-out"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Log Out
    </Button>
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