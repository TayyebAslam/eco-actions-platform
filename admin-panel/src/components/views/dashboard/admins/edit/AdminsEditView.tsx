"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminsApi, schoolsApi, jobTitlesApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import { PermissionsForm } from "@/components/forms/permissions-form";
import { usePermissions } from "@/hooks/usePermissions";
import { BackLinkButton } from "@/components/ui/back-link-button";

export function AdminsEditView() {
  const router = useRouter();
  const params = useParams();
  const adminId = Number(params.id);
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();
  
  // Get tab from URL search params
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const tabFromUrl = searchParams.get('tab') || 'details';
  
  const [activeTab, setActiveTab] = useState("details");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "admin",
    school_id: "none",
    job_title_id: "",
  });

  const { data: admin, isLoading: isLoadingAdmin } = useQuery({
    queryKey: ["admin", adminId],
    queryFn: async () => {
      const response = await adminsApi.getById(adminId);
      return response.data.data;
    },
    enabled: !!adminId,
  });

  // Fetch schools for dropdown
  const { data: schoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
  });

  const schools = schoolsData || [];

  // Fetch job titles dropdown
  const { data: jobTitles, isLoading: isLoadingJobTitles } = useQuery({
    queryKey: ["job-titles-dropdown"],
    queryFn: async () => {
      const response = await jobTitlesApi.getDropdown();
      return response.data.data;
    },
  });

  // Add Role dialog state
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<"global" | "system" | "school">("global");

  const addRoleMutation = useMutation({
    mutationFn: () => jobTitlesApi.create({
      name: newRoleName.trim(),
      description: newRoleDescription.trim() || undefined,
      scope: newRoleScope,
    }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["job-titles-dropdown"] });
      const newId = response.data.data?.id;
      if (newId) {
        setFormData((prev) => ({ ...prev, job_title_id: String(newId) }));
      }
      toast.success("Job title created successfully");
      setShowAddRole(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setNewRoleScope("global");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create job title");
    },
  });

  useEffect(() => {
    if (admin) {
      setFormData({
        first_name: admin.first_name || "",
        last_name: admin.last_name || "",
        email: admin.email || "",
        role: admin.role || "admin",
        school_id: admin.school_id ? String(admin.school_id) : "none",
        job_title_id: admin.job_title_id ? String(admin.job_title_id) : "",
      });
    }
  }, [admin]);

  // Determine if we should show permissions tab
  const canEditPermissions =
    admin &&
    ((user?.role === "super_admin" &&
      (admin.role === "admin" || admin.role === "sub_admin")) ||
      ((user?.role === "admin" || user?.role === "school_admin") && admin.role === "sub_admin"));

  const mutation = useMutation({
    mutationFn: () => {
      const updateData: any = {
        ...formData,
      };

      // Handle school_id: convert "none" to undefined, or parse as number
      if (formData.school_id === "none" || !formData.school_id) {
        updateData.school_id = undefined;
      } else {
        updateData.school_id = Number(formData.school_id);
      }

      // Handle job_title_id
      if (formData.job_title_id && formData.job_title_id !== "none") {
        updateData.job_title_id = Number(formData.job_title_id);
      }

      return adminsApi.update(adminId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      queryClient.invalidateQueries({ queryKey: ["admin", adminId] });
      toast.success("Admin updated successfully");
      router.push("/dashboard/admins");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update admin");
    },
  });

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (
      formData.role === "sub_admin" &&
      (!formData.job_title_id || formData.job_title_id === "none")
    ) {
      newErrors.job_title_id = "Job title is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    mutation.mutate();
  };

  if (isLoadingAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
        <div className="mt-4 flex justify-center">
          <BackLinkButton
            href="/dashboard/admins"
            label={isSuperAdmin ? "Back to School Admins" : "Back to System Users"}
          />
        </div>
      </div>
    );
  }

  const renderDetailsForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>{isSuperAdmin ? "School Admin Details" : "System User Details"}</CardTitle>
        <CardDescription>{isSuperAdmin ? "Update school admin account information" : "Update system user account information"}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleFieldChange("first_name", e.target.value)}
                placeholder="John"
                maxLength={50}
                className={errors.first_name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleFieldChange("last_name", e.target.value)}
                placeholder="Doe"
                maxLength={50}
                className={errors.last_name ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              placeholder="admin@eco-actions.com"
              maxLength={255}
              className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            {isSuperAdmin ? (
              <Select
                key={`role-select-${formData.role}`}
                value={formData.role}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, role: value, job_title_id: value !== "sub_admin" ? "" : prev.job_title_id }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sub_admin">Sub Admin</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={formData.role === "sub_admin" ? "Sub Admin" : "Admin"}
                disabled
                className="bg-muted"
              />
            )}
          </div>

          {/* School Assignment */}
          <div className="space-y-2">
            <Label htmlFor="school">Assigned School</Label>
            <Select
              value={formData.school_id}
              onValueChange={(value) =>
                setFormData({ ...formData, school_id: value })
              }
              key={`school-select-${formData.school_id}-${schools.length}`}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a school" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingSchools ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : schools.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No schools found
                  </div>
                ) : (
                  <>
                    <SelectItem value="none">No School</SelectItem>
                    {schools.map((school: any) => (
                      <SelectItem key={school.id} value={String(school.id)}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Job Title (only for sub_admin) */}
          {formData.role === "sub_admin" && (
            <div className="space-y-2">
              <Label htmlFor="job_title_id">Job Title *</Label>
              <Select
                key={`job-title-select-${formData.job_title_id}-${jobTitles?.length ?? 0}`}
                value={formData.job_title_id || undefined}
                onValueChange={(value) => {
                  if (value === "__add_new") {
                    setShowAddRole(true);
                    return;
                  }
                  setFormData((prev) => ({ ...prev, job_title_id: value }));
                  if (errors.job_title_id) setErrors((prev) => ({ ...prev, job_title_id: "" }));
                }}
              >
                <SelectTrigger
                  id="job_title_id"
                  className={errors.job_title_id ? "border-destructive focus-visible:ring-destructive" : ""}
                >
                  <SelectValue placeholder="Select a job title" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingJobTitles ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Loading...
                    </div>
                  ) : jobTitles && jobTitles.length > 0 ? (
                    jobTitles.map((jobTitle: any) => (
                      <SelectItem key={jobTitle.id} value={String(jobTitle.id)}>
                        {jobTitle.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No job titles available
                    </div>
                  )}
                  {isSuperAdmin && (
                    <>
                      <Separator className="my-1" />
                      <SelectItem value="__add_new" className="text-primary font-medium">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Add New Job Title
                        </span>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {errors.job_title_id && (
                <p className="text-sm text-destructive">{errors.job_title_id}</p>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/admins")}
            >
              Cancel
            </Button>
            <Button type="submit" variant={"secondary"} disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSuperAdmin ? "Update School Admin" : "Update System User"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isSuperAdmin ? "Edit School Admin" : "Edit System User"}</h1>
          <p className="text-muted-foreground">
            {admin.first_name} {admin.last_name} ({admin.email})
          </p>
        </div>
        <BackLinkButton href="/dashboard/admins" />
      </div>

      <div className="w-full">
        {canEditPermissions ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="permissions">
                <Shield className="mr-2 h-4 w-4" />
                Permissions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="details">{renderDetailsForm()}</TabsContent>
            <TabsContent value="permissions">
              <Card>
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                  <CardDescription>
                    Manage module access permissions for this user
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PermissionsForm
                    userId={adminId}
                    targetUserRole={admin.role}
                    onSaved={() => { }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          renderDetailsForm()
        )}
      </div>

      {/* Add Job Title Dialog */}
      <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Job Title</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_role_name">Job Title Name *</Label>
                <Input
                  id="new_role_name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Content Manager"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Scope *</Label>
                <Select
                  value={newRoleScope}
                  onValueChange={(value: "global" | "system" | "school") => setNewRoleScope(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (Everyone)</SelectItem>
                    <SelectItem value="system">System (Super Admin users)</SelectItem>
                    <SelectItem value="school">School (School Admin users)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_role_description">Description</Label>
              <Input
                id="new_role_description"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRole(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => addRoleMutation.mutate()}
              disabled={!newRoleName.trim() || addRoleMutation.isPending}
            >
              {addRoleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Job Title
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
