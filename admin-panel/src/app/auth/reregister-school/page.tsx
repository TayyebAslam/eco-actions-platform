"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { schoolRequestsApi } from "@/lib/api";
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
  School as SchoolIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
  TreePine,
  Recycle,
  Sun,
  Wind,
  Droplets,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ReRegisterSchoolPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reregistrationToken, setReregistrationToken] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [adminEmail, setAdminEmail] = useState<string>("");

  const [formData, setFormData] = useState({
    admin_first_name: "",
    admin_last_name: "",
    school_name: "",
    school_slug: "",
    school_address: "",
  });

  const [schoolLogo, setSchoolLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Keys set by auth-provider on rejected login
    const token = sessionStorage.getItem("reregistrationToken");
    const reason = sessionStorage.getItem("rejectionReason");
    const email = sessionStorage.getItem("adminEmail");

    if (!token) {
      toast.error("Session expired. Please login again.");
      router.push("/auth/login");
      return;
    }

    setReregistrationToken(token);
    setRejectionReason(reason || "Your previous registration was rejected.");
    setAdminEmail(email || "");
  }, [router]);

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

  const handleSchoolNameChange = (name: string) => {
    setFormData({
      ...formData,
      school_name: name,
      school_slug: name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    });
    // Clear error when user types
    if (errors.school_name) {
      setErrors(prev => ({ ...prev, school_name: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.admin_first_name.trim()) {
      newErrors.admin_first_name = "First name is required";
    }

    if (!formData.admin_last_name.trim()) {
      newErrors.admin_last_name = "Last name is required";
    }

    if (!formData.school_name.trim()) {
      newErrors.school_name = "School name is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!reregistrationToken) {
      toast.error("Session expired. Please login again.");
      router.push("/auth/login");
      return;
    }

    setIsLoading(true);

    try {
      const data = new FormData();
      data.append("reregistration_token", reregistrationToken);
      data.append("admin_first_name", formData.admin_first_name);
      data.append("admin_last_name", formData.admin_last_name);
      data.append("school_name", formData.school_name);
      data.append("school_slug", formData.school_slug);
      if (formData.school_address) data.append("school_address", formData.school_address);
      if (schoolLogo) data.append("school_logo", schoolLogo);

      await schoolRequestsApi.reregister(data);

      // Clear session storage
      sessionStorage.removeItem("reregistration_token");
      sessionStorage.removeItem("rejection_reason");
      sessionStorage.removeItem("admin_first_name");
      sessionStorage.removeItem("admin_last_name");
      sessionStorage.removeItem("admin_email");

      setIsSubmitted(true);
      toast.success("School registration re-submitted successfully!");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(
        err.response?.data?.message ||
          "Failed to re-submit registration. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (isSubmitted) {
    return (
      <div className="h-screen flex overflow-hidden">
        {/* Left Side - Decorative (Fixed, no scroll) */}
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
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-green-300/20 rounded-full blur-2xl" />

          <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                <Leaf className="h-8 w-8 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Thrive</span>
            </div>

            <div className="flex-1 flex flex-col justify-center max-w-lg">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
                Thank You!{" "}
                <span className="text-emerald-200">Re-submitted</span>
              </h1>
              <p className="text-lg text-white/80 mb-10 leading-relaxed">
                Your school registration has been re-submitted for review.
                We&apos;ll notify you once your request has been processed.
              </p>

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">Update your information</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-white/70 line-through">Re-submit registration</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 pt-8 border-t border-white/20">
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

        {/* Right Side (Scrollable) */}
        <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-[420px] py-4">
            <div className="lg:hidden text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                  <Leaf className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">Thrive</span>
              </div>
              <p className="text-gray-500 text-sm">Sustainability Ecosystem</p>
            </div>

            <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Registration Re-submitted!
                </CardTitle>
                <CardDescription className="text-gray-500 mt-1">
                  Your school registration is pending approval
                </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center mb-6">
                  <p className="text-emerald-700 text-sm leading-relaxed">
                    Thank you for re-submitting your school registration! Your request
                    has been received and is now pending approval from our admin team.
                  </p>
                </div>
                <p className="text-sm text-gray-500 text-center mb-6">
                  You will receive an email notification once your request has been
                  reviewed. This typically takes 1-2 business days.
                </p>
                <Link href="/auth/login">
                  <Button className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base">
                    Go to Login
                  </Button>
                </Link>
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

  if (!reregistrationToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Side - Decorative (Fixed, no scroll) */}
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
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-green-300/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20">
              <Leaf className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Thrive</span>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
              Re-register{" "}
              <span className="text-emerald-200">Your School</span>
            </h1>
            <p className="text-lg text-white/80 mb-10 leading-relaxed">
              Your previous registration was not approved. Please review and
              update your information to re-submit your registration.
            </p>

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

      {/* Right Side - Form (Scrollable) */}
      <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] py-4">
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                <Leaf className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Thrive</span>
            </div>
            <p className="text-gray-500 text-sm">Sustainability Ecosystem</p>
          </div>

          <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
            <CardHeader className="text-center pb-4 pt-8">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
                <SchoolIcon className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                Update & Re-submit
              </CardTitle>
              <CardDescription className="text-gray-500 mt-1">
                Please update your information and try again
              </CardDescription>

              {adminEmail && (
                <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-gray-500 text-xs">Email: {adminEmail}</p>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {/* Rejection Warning Banner - Inside Card */}
              <div className="bg-gradient-to-r from-destructive/5 to-warning/10 border border-destructive/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-destructive/15 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive-strong text-sm">Registration Rejected</h3>
                    <div className="mt-1.5 bg-white/80 dark:bg-white/5 rounded-lg p-2.5 border border-destructive/15">
                      <p className="text-destructive text-xs">{rejectionReason || "No specific reason provided."}</p>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="admin_first_name" className="text-gray-700 font-medium">
                      First Name *
                    </Label>
                    <Input
                      id="admin_first_name"
                      value={formData.admin_first_name}
                      onChange={(e) => {
                        setFormData({ ...formData, admin_first_name: e.target.value });
                        if (errors.admin_first_name) {
                          setErrors(prev => ({ ...prev, admin_first_name: "" }));
                        }
                      }}
                      placeholder="John"
                      disabled={isLoading}
                      className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${errors.admin_first_name ? "border-red-500" : ""}`}
                    />
                    {errors.admin_first_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin_first_name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_last_name" className="text-gray-700 font-medium">
                      Last Name *
                    </Label>
                    <Input
                      id="admin_last_name"
                      value={formData.admin_last_name}
                      onChange={(e) => {
                        setFormData({ ...formData, admin_last_name: e.target.value });
                        if (errors.admin_last_name) {
                          setErrors(prev => ({ ...prev, admin_last_name: "" }));
                        }
                      }}
                      placeholder="Doe"
                      disabled={isLoading}
                      className={`h-11 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-lg ${errors.admin_last_name ? "border-red-500" : ""}`}
                    />
                    {errors.admin_last_name && (
                      <p className="text-sm text-red-500 mt-1">{errors.admin_last_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school_name" className="text-gray-700 font-medium">
                    School Name *
                  </Label>
                  <Input
                    id="school_name"
                    value={formData.school_name}
                    onChange={(e) => handleSchoolNameChange(e.target.value)}
                    placeholder="Green Valley High School"
                    disabled={isLoading}
                    className={`h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-xl ${errors.school_name ? "border-red-500" : ""}`}
                  />
                  {errors.school_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.school_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school_slug" className="text-gray-700 font-medium">
                    Domain / Slug
                  </Label>
                  <Input
                    id="school_slug"
                    value={formData.school_slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        school_slug: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, "-")
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                    placeholder="green-valley-high-school"
                    disabled={isLoading}
                    className="h-12 bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-xl"
                  />
                  <p className="text-xs text-gray-500">
                    Auto-generated from school name. Used for URL.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">School Logo</Label>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 rounded-lg">
                      <AvatarImage
                        src={logoPreview || undefined}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-lg bg-emerald-50">
                        <SchoolIcon className="h-6 w-6 text-emerald-600" />
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
                        className="bg-white rounded-lg"
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
                  <Label htmlFor="school_address" className="text-gray-700 font-medium">
                    Address
                  </Label>
                  <Textarea
                    id="school_address"
                    value={formData.school_address}
                    onChange={(e) =>
                      setFormData({ ...formData, school_address: e.target.value })
                    }
                    placeholder="123 Eco Street, Green City"
                    rows={2}
                    disabled={isLoading}
                    className="bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-emerald-500 rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base mt-6"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Re-submitting...
                    </>
                  ) : (
                    "Re-submit Registration"
                  )}
                </Button>
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
