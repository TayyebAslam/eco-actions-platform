"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, School as SchoolIcon, Pencil, Users, GraduationCap } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

import type { SubscriptionStatus } from "@/lib/school-status-utils";
import { parseSubscriptionStatus, normalizeSubscriptionStatus } from "@/lib/school-status-utils";


export function SchoolFormView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const schoolId = params?.id ? Number(params.id) : undefined;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isViewMode = !!schoolId && searchParams?.get("mode") === "view";
  const isEditMode = !!schoolId && !isViewMode;
  const urlStatus = parseSubscriptionStatus(searchParams?.get("status"));

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    subscription_status: "active",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const initialized = useRef(false);

  // Fetch school data for edit or view mode
  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ["school", schoolId],
    queryFn: async () => {
      const response = await schoolsApi.getById(schoolId!);
      return response.data.data;
    },
    enabled: !!schoolId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (school && !initialized.current) {
      initialized.current = true;
      const storageStatus = schoolId && typeof window !== "undefined"
        ? parseSubscriptionStatus(localStorage.getItem(`school-status-override-${schoolId}`))
        : null;
      const normalizedStatus = urlStatus || storageStatus || normalizeSubscriptionStatus(school);
      setFormData({
        name: school.name || "",
        address: school.address || "",
        subscription_status: normalizedStatus,
      });
      if (school.logo_url) {
        setLogoPreview(school.logo_url);
      }
    }
  }, [school, schoolId, urlStatus]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image file (JPG, PNG, or GIF)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedName = formData.name.trim();
      const trimmedAddress = formData.address.trim();
      const data = new FormData();
      data.append("name", trimmedName);
      if (trimmedAddress) data.append("address", trimmedAddress);
      
      if (isEditMode) {
        const normalizedStatus = normalizeSubscriptionStatus({ subscription_status: formData.subscription_status });
        data.append("subscription_status", normalizedStatus);
        data.append("status", normalizedStatus);
        data.append("is_active", normalizedStatus === "active" ? "1" : "0");
      }
      
      if (logoFile) data.append("logo", logoFile);
      
      return isEditMode
        ? schoolsApi.update(schoolId!, data)
        : schoolsApi.create(data);
    },
    onSuccess: () => {
      // clear any override stored during editing so future loads reflect server state
      if (isEditMode && schoolId && typeof window !== "undefined") {
        localStorage.removeItem(`school-status-override-${schoolId}`);
      }
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["school", schoolId] });
      }
      toast.success(isEditMode ? "School updated successfully" : "School created successfully");
      router.push("/dashboard/schools");
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || (isEditMode ? "Failed to update school" : "Failed to create school"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: "School name is required" });
      return;
    }
    setErrors({});
    mutation.mutate();
  };

  const getTitle = () => {
    if (isViewMode) return "School Details";
    if (isEditMode) return "Edit School";
    return "Create School";
  };

  const getDescription = () => {
    if (isViewMode) return school?.name || "";
    if (isEditMode) return school?.name || "";
    return "Add a new school to the ecosystem";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
      case "inactive":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Inactive</Badge>;
      case "suspended":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive-strong border-destructive/20">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingSchool && schoolId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (schoolId && !school && !isLoadingSchool) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">School not found</p>
        <div className="mt-4 flex justify-center">
          <BackLinkButton href="/dashboard/schools" label="Back to Schools" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{getTitle()}</h1>
          <p className="text-muted-foreground">{getDescription()}</p>
        </div>
        <div className="flex items-center gap-3">
          <BackLinkButton href="/dashboard/schools" />
          {isViewMode && (
            <Button
              onClick={() => router.push(`/dashboard/schools/${schoolId}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit School
            </Button>
          )}
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>School Information</CardTitle>
          <CardDescription>
            {isViewMode ? "View the school details" : isEditMode ? "Update the school information" : "Fill in the details to create a new school"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>School Logo</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-lg">
                  <AvatarImage src={logoPreview || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-primary/10">
                    <SchoolIcon className="h-8 w-8 text-primary" />
                  </AvatarFallback>
                </Avatar>
                {!isViewMode && (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      accept="image/jpeg,image/jpg,image/png,image/gif"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {logoPreview ? "Change Logo" : "Upload Logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG or GIF. Max 5MB.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* School Name */}
            <div className="space-y-2">
                  <Label htmlFor="name">School Name *</Label>
                  {isViewMode ? (
                    <p className="text-sm font-medium py-2 break-words">{formData.name}</p>
                  ) : (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (errors.name) {
                          setErrors((prev) => ({ ...prev, name: "" }));
                        }
                      }}
                      placeholder="Green Valley High School"
                      maxLength={255}
                      className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  )}
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name}</p>
                  )}
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  {isViewMode ? (
                    <p className="text-sm py-2 break-words">{formData.address || "N/A"}</p>
                  ) : (
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="123 Eco Street, Green City, State 12345"
                      maxLength={500}
                      rows={3}
                    />
                  )}
                </div>

                {/* Subscription Status */}
                {isEditMode && (
                  <div className="space-y-2">
                    <Label htmlFor="subscription_status">Subscription Status</Label>
                    <Select
                      value={normalizeSubscriptionStatus({ subscription_status: formData.subscription_status })}
                      onValueChange={(value) =>
                        setFormData({ ...formData, subscription_status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}


            {/* View Mode: Stats and Metadata */}
            {isViewMode && school && (
              <>
                <div className="pt-4 border-t">
                  <Label className="text-base font-semibold mb-3 block">Statistics</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        <span className="text-sm">Staff</span>
                      </div>
                      <span className="text-lg font-semibold">
                        {school.staff_count || 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Students</span>
                      </div>
                      <span className="text-lg font-semibold">
                        {school.students_count || 0}
                      </span>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* Actions */}
            {!isViewMode && (
              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard/schools")}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" disabled={mutation.isPending}>
                  {mutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditMode ? "Update School" : "Create School"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
