"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { systemUsersApi, permissionsApi, jobTitlesApi } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/ui/back-link-button";

interface ModulePermission {
  module_id: number;
  name: string;
  key: string;
  scope: string;
  can_create: boolean;
  can_read: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export function CreateSystemUserView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title_id: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [permissions, setPermissions] = useState<ModulePermission[]>([]);

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

  // Fetch job titles dropdown
  const { data: jobTitles, isLoading: isLoadingJobTitles } = useQuery({
    queryKey: ["job-titles-dropdown"],
    queryFn: async () => {
      const response = await jobTitlesApi.getDropdown();
      return response.data.data;
    },
  });

  // Fetch all modules
  const { isLoading: isLoadingModules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const response = await permissionsApi.getModules();
      const allModules = response.data.data;
      // System users only get school scope modules
      const schoolModules = allModules.filter((m: any) => m.scope === "school");

      setPermissions(
        schoolModules.map((m: any) => ({
          module_id: m.id,
          name: m.name,
          key: m.key,
          scope: m.scope,
          can_create: false,
          can_read: false,
          can_edit: false,
          can_delete: false,
        }))
      );

      return schoolModules;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const createResponse = await systemUsersApi.create({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        job_title_id: Number(formData.job_title_id),
      });

      const userId = createResponse.data.data.id;
      await permissionsApi.updateUserPermissions(userId, permissions);

      return createResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      toast.success("User created successfully. Password has been sent to their email.");
      router.push("/dashboard/system-users");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create user");
    },
  });

  const handleToggle = (
    moduleId: number,
    field: "can_create" | "can_read" | "can_edit" | "can_delete"
  ) => {
    if (errors.permissions) {
      setErrors((prev) => ({ ...prev, permissions: "" }));
    }
    setPermissions((prev) =>
      prev.map((p) => {
        if (p.module_id === moduleId) {
          const newValue = !p[field];

          if ((field === "can_create" || field === "can_edit") && newValue) {
            return { ...p, [field]: newValue, can_read: true };
          }

          if (field === "can_read" && !newValue) {
            return { ...p, [field]: newValue, can_create: false, can_edit: false };
          }

          return { ...p, [field]: newValue };
        }
        return p;
      })
    );
  };

  const handleSelectAll = (moduleId: number, checked: boolean) => {
    if (errors.permissions) {
      setErrors((prev) => ({ ...prev, permissions: "" }));
    }
    setPermissions((prev) =>
      prev.map((p) =>
        p.module_id === moduleId
          ? {
              ...p,
              can_create: checked,
              can_read: checked,
              can_edit: checked,
              can_delete: checked,
            }
          : p
      )
    );
  };

  const handleSelectAllModules = (checked: boolean) => {
    if (errors.permissions) {
      setErrors((prev) => ({ ...prev, permissions: "" }));
    }
    setPermissions((prev) =>
      prev.map((p) => ({
        ...p,
        can_create: checked,
        can_read: checked,
        can_edit: checked,
        can_delete: checked,
      }))
    );
  };

  const allSelected = permissions.length > 0 && permissions.every(
    (p) => p.can_create && p.can_read && p.can_edit && p.can_delete
  );

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    } else if (formData.first_name.trim().length < 2) {
      newErrors.first_name = "First name must be at least 2 characters";
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    } else if (formData.last_name.trim().length < 2) {
      newErrors.last_name = "Last name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.job_title_id || formData.job_title_id === "none") {
      newErrors.job_title_id = "Job title is required";
    }

    const hasAnyPermission = permissions.some(
      (p) => p.can_create || p.can_read || p.can_edit || p.can_delete
    );
    if (!hasAnyPermission) {
      newErrors.permissions = "Please assign at least one permission";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    mutation.mutate();
  };

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">You do not have permission to access this page</p>
        <div className="mt-4 flex justify-center">
          <BackLinkButton href="/dashboard" label="Back to Dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">

        <div>
          <h1 className="text-2xl font-bold">Create System User</h1>
          <p className="text-muted-foreground">Add a new platform administrator with permissions</p>
        </div>
        <BackLinkButton href="/dashboard/system-users" />
        
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* User Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>
              Fill in the basic information for the new system user.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleFieldChange("first_name", e.target.value)}
                  placeholder="John"
                  maxLength={50}
                  aria-describedby={errors.first_name ? "first_name-error" : undefined}
                  className={errors.first_name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.first_name && (
                  <p id="first_name-error" className="text-sm text-destructive">{errors.first_name}</p>
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
                  aria-describedby={errors.last_name ? "last_name-error" : undefined}
                  className={errors.last_name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.last_name && (
                  <p id="last_name-error" className="text-sm text-destructive">{errors.last_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="user@thrive.com"
                  maxLength={255}
                  aria-describedby={errors.email ? "email-error" : "email-hint"}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.email ? (
                  <p id="email-error" className="text-sm text-destructive">{errors.email}</p>
                ) : (
                  <p id="email-hint" className="text-sm text-muted-foreground">
                    A password will be auto-generated and sent to this email address.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title_id">Job Title *</Label>
                <Select
                  value={formData.job_title_id || undefined}
                  onValueChange={(value) => {
                    if (value === "__add_new") {
                      setShowAddRole(true);
                      return;
                    }
                    setFormData({ ...formData, job_title_id: value });
                    if (errors.job_title_id) {
                      setErrors((prev) => ({ ...prev, job_title_id: "" }));
                    }
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
                    <Separator className="my-1" />
                    <SelectItem value="__add_new" className="text-primary font-medium">
                      <span className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Add New Job Title
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.job_title_id ? (
                  <p className="text-sm text-destructive">{errors.job_title_id}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Assign a job title to this user
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions Card */}
        <Card className={errors.permissions ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Manage module access permissions for this user
            </CardDescription>
            {errors.permissions && (
              <p className="text-sm text-destructive mt-1">{errors.permissions}</p>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingModules ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Select All */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    id="select-all-permissions"
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAllModules(!!checked)}
                  />
                  <Label htmlFor="select-all-permissions" className="font-medium cursor-pointer">
                    Select All Permissions
                  </Label>
                </div>

                {/* Header */}
                <div className="grid grid-cols-6 gap-4 px-4 py-2 bg-muted rounded-lg font-medium text-sm">
                  <div className="col-span-2">Module</div>
                  <div className="text-center">Read</div>
                  <div className="text-center">Create</div>
                  <div className="text-center">Edit</div>
                  <div className="text-center">Delete</div>
                </div>

                {/* Permission Rows */}
                <div className="space-y-2">
                  {permissions.map((permission) => {
                    const allChecked =
                      permission.can_read &&
                      permission.can_create &&
                      permission.can_edit &&
                      permission.can_delete;

                    return (
                      <div
                        key={permission.module_id}
                        className="grid grid-cols-6 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-muted/50 transition-colors"
                      >
                        <div className="col-span-2 flex items-center gap-2">
                          <Checkbox
                            id={`module-${permission.module_id}`}
                            checked={allChecked}
                            onCheckedChange={(checked) =>
                              handleSelectAll(permission.module_id, !!checked)
                            }
                          />
                          <Label
                            htmlFor={`module-${permission.module_id}`}
                            className="font-medium cursor-pointer"
                          >
                            {permission.name}
                          </Label>
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permission.can_read}
                            onCheckedChange={() =>
                              handleToggle(permission.module_id, "can_read")
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permission.can_create}
                            onCheckedChange={() =>
                              handleToggle(permission.module_id, "can_create")
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permission.can_edit}
                            onCheckedChange={() =>
                              handleToggle(permission.module_id, "can_edit")
                            }
                          />
                        </div>
                        <div className="flex justify-center">
                          <Checkbox
                            checked={permission.can_delete}
                            onCheckedChange={() =>
                              handleToggle(permission.module_id, "can_delete")
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/system-users")}
          >
            Cancel
          </Button>
          <Button type="submit" variant="secondary" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create User
          </Button>
        </div>
      </form>

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
