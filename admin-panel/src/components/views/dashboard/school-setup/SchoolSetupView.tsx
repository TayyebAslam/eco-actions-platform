"use client";

import { useState, useRef } from "react";
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
import { Leaf, Loader2, School, Upload } from "lucide-react";
import { toast } from "sonner";

export function SchoolSetupView() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({    name: "",
    slug: "",
    address: "",
  });

  const [schoolLogo, setSchoolLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "School name is required";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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

      toast.success("School registered successfully!");

      // Refresh user data to get updated school_id
      await refreshUser();

      // Redirect to dashboard
      router.push("/dashboard");
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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/30">
              <Leaf className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold">Thrive</span>
          </div>
          <p className="text-muted-foreground text-sm">Complete Your Registration</p>
        </div>

        <Card>
          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl shadow-emerald-500/30">
              <School className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">
              School Registration
            </CardTitle>
            <CardDescription className="mt-1">
              Fill in your school details to complete your registration
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">School Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    handleSchoolNameChange(e.target.value);
                    if (errors.name) {
                      setErrors(prev => ({ ...prev, name: "" }));
                    }
                  }}
                  placeholder="Green Valley High School"
                  disabled={isLoading}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Domain / Slug</Label>
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
                />
                <p className="text-xs text-muted-foreground">
                  Auto-generated from school name. Used for URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label>School Logo</Label>
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 rounded-lg">
                    <AvatarImage
                      src={logoPreview || undefined}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                      <School className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="123 Eco Street, Green City"
                  rows={2}
                  disabled={isLoading}
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
                    Registering...
                  </>
                ) : (
                  "Complete Registration"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Thrive. Making the world greener.
        </p>
      </div>
    </div>
  );
}
