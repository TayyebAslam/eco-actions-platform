"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  XCircle,
  TreePine,
  Recycle,
  Sun,
  Wind,
  Droplets,
} from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const data = searchParams.get("data");

  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSchool, setHasSchool] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!data) {
        setError("Invalid verification link");
        setIsVerifying(false);
        return;
      }

      try {
        const response = await authApi.verifyEmail(data);
        setIsSuccess(true);
        setHasSchool(response.data?.data?.hasSchool || false);
        toast.success("Email verified successfully!");
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setError(error.response?.data?.message || "Failed to verify email");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [data]);

  const handleContinue = () => {
    router.push("/auth/login");
  };

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
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-green-300/20 rounded-full blur-2xl" />

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
              {isVerifying
                ? "Verifying Your Email..."
                : isSuccess
                ? "Welcome to "
                : "Oops! "}
              {!isVerifying && (
                <span className="text-emerald-200">
                  {isSuccess ? "Thrive" : "Something Went Wrong"}
                </span>
              )}
            </h1>
            <p className="text-lg text-white/80 mb-10 leading-relaxed">
              {isVerifying
                ? "Please wait while we verify your email address. This will only take a moment."
                : isSuccess
                ? "Your email has been verified. You're now ready to start making a positive environmental impact with your school."
                : "We couldn't verify your email. The link may have expired or is invalid."}
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
          <div className="flex items-center gap-8 mt-2 pt-6 border-t border-white/20">
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

      {/* Right Side - Verification Card */}
      <div className="w-full lg:w-[45%] bg-gray-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
                <Leaf className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Thrive</span>
            </div>
            <p className="text-gray-500 text-sm">Sustainability Ecosystem</p>
          </div>

          {/* Verification Card */}
          <Card className="border-0 shadow-2xl shadow-gray-200/50 bg-white">
            <CardHeader className="text-center pb-4 pt-8">
              <div
                className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl ${
                  isVerifying
                    ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30"
                    : isSuccess
                    ? "bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30"
                    : "bg-destructive/15 shadow-destructive/30"
                }`}
              >
                {isVerifying ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-8 w-8 text-white" />
                ) : (
                  <XCircle className="h-8 w-8 text-destructive" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isVerifying
                  ? "Verifying Email..."
                  : isSuccess
                  ? "Email Verified!"
                  : "Verification Failed"}
              </CardTitle>
              <CardDescription className="text-gray-500 mt-1">
                {isVerifying
                  ? "Please wait while we verify your email"
                  : isSuccess
                  ? "Your email has been successfully verified"
                  : error}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              {!isVerifying && (
                <>
                  {isSuccess ? (
                    <div className="space-y-5">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <p className="text-emerald-700 text-sm">
                          {hasSchool
                            ? "You can now log in to access your admin dashboard."
                            : "You can now log in and complete your school registration."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleContinue}
                        className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                      >
                        Continue to Login
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleContinue}
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all duration-300 rounded-xl text-base"
                    >
                      Back to Login
                    </Button>
                  )}
                </>
              )}
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
