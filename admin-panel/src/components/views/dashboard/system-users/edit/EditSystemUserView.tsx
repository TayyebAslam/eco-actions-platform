"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { systemUsersApi, permissionsApi, jobTitlesApi } from "@/lib/api";
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
import { usePermissions } from "@/hooks/usePermissions";
import { ModulePermission, User } from "@/types";

interface JobTitleObject {
  id?: number | string;
  job_title_id?: number | string;
  name?: string;
  value?: number | string;
}

interface UserWithJobTitle extends Partial<User> {
  jobTitleId?: number | string | null;
  job_title?: string | JobTitleObject;
}

const getJobTitleIdFromUser = (user: UserWithJobTitle | undefined): string => {
  if (!user) return "";

  const jobTitle = user.job_title;
  const jobTitleObj = typeof jobTitle === "object" && jobTitle !== null ? jobTitle : undefined;

  const directCandidates = [
    user.job_title_id,
    user.jobTitleId,
    jobTitleObj?.id,
    jobTitleObj?.job_title_id,
    jobTitleObj?.value,
  ];

  for (const value of directCandidates) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  // Some APIs return `job_title` as the id directly.
  if (
    (typeof user.job_title_id === "number" && Number.isFinite(user.job_title_id)) ||
    (typeof user.job_title_id === "string" && /^\d+$/.test(user.job_title_id))
  ) {
    return String(user.job_title_id).trim();
  }

  return "";
};
import { BackLinkButton } from "@/components/ui/back-link-button";

export function EditSystemUserView() {
  const router = useRouter();
  const params = useParams();
  const systemUserId = Number(params.id);
  const { isSuperAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [permissionError, setPermissionError] = useState("");
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
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
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

  const { data: systemUser, isLoading: isLoadingSystemUser } = useQuery({
    queryKey: ["system-user", systemUserId],
    queryFn: async () => {
      const response = await systemUsersApi.getById(systemUserId);
      return response.data.data;
    },
    enabled: !!systemUserId,
  });

  // Fetch user permissions
  const { data: permissionsData, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["user-permissions", systemUserId],
    queryFn: async () => {
      const response = await permissionsApi.getUserPermissions(systemUserId);
      return response.data.data;
    },
    enabled: !!systemUserId,
  });

  useEffect(() => {
    if (systemUser) {
      setFormData({
        first_name: systemUser.first_name || "",
        last_name: systemUser.last_name || "",
        email: systemUser.email || "",
        job_title_id: getJobTitleIdFromUser(systemUser),
      });
    }
  }, [systemUser]);

  // Fallback: when user API gives only job title name, resolve id from dropdown.
  useEffect(() => {
    if (!systemUser || !Array.isArray(jobTitles) || formData.job_title_id) {
      return;
    }

    const rawName =
      systemUser.job_title_name ||
      systemUser.job_title?.name ||
      (typeof systemUser.job_title === "string" ? systemUser.job_title : "");
    const normalizedName = String(rawName || "").trim().toLowerCase();
    if (!normalizedName) return;

    const matched = jobTitles.find(
      (jobTitle: { id?: number | string; name?: string }) => String(jobTitle.name || "").trim().toLowerCase() === normalizedName
    );

    if (matched?.id != null) {
      setFormData((prev) => ({ ...prev, job_title_id: String(matched.id) }));
    }
  }, [systemUser, jobTitles, formData.job_title_id]);

  useEffect(() => {
    if (permissionsData?.permissions) {
      // System users only see school scope modules
      setPermissions(permissionsData.permissions.filter((p: ModulePermission) => p.scope === "school"));
    }
  }, [permissionsData]);

  const updateUserMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
      };

      if (formData.job_title_id && formData.job_title_id !== "none") {
        payload.job_title_id = Number(formData.job_title_id);
      }

      return systemUsersApi.update(systemUserId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      queryClient.invalidateQueries({ queryKey: ["system-user", systemUserId] });
      toast.success("User updated successfully");
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "Failed to update user");
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: () => {
      const permissionData = permissions.map((p) => ({
        module_id: p.module_id,
        can_create: p.can_create,
        can_read: p.can_read,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));
      return permissionsApi.updateUserPermissions(systemUserId, permissionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", systemUserId] });
      toast.success("Permissions updated successfully");
    },
    onError: () => {
      toast.error("Failed to update permissions");
    },
  });

  const handleToggle = (
    moduleId: number,
    field: "can_create" | "can_read" | "can_edit" | "can_delete"
  ) => {
    if (permissionError) {
      setPermissionError("");
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
    if (permissionError) {
      setPermissionError("");
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
    if (permissionError) {
      setPermissionError("");
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

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }
    if (!formData.job_title_id || formData.job_title_id === "none") {
      newErrors.job_title_id = "Job title is required";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    updateUserMutation.mutate();
  };

  const handlePermissionsSave = () => {
    const hasAnyPermission = permissions.some(
      (p) => p.can_create || p.can_read || p.can_edit || p.can_delete
    );

    if (!hasAnyPermission) {
      setPermissionError("Please assign at least one permission");
      return;
    }

    setPermissionError("");
    updatePermissionsMutation.mutate();
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

  if (isLoadingSystemUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!systemUser) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">User not found</p>
        <div className="mt-4 flex justify-center">
          <BackLinkButton href="/dashboard/system-users" label="Back to System Users" />
        </div>
      </div>
    );
  }

  const hasSelectedJobTitleInOptions =
    Array.isArray(jobTitles) &&
    jobTitles.some((jobTitle: { id?: number | string }) => String(jobTitle.id) === formData.job_title_id);
  const currentJobTitleLabel =
    systemUser.job_title_name ||
    systemUser.job_title?.name ||
    "Current Job Title";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Edit System User</h1>
          <p className="text-muted-foreground">
            {systemUser.first_name} {systemUser.last_name} ({systemUser.email})
          </p>
        </div>
        <BackLinkButton href="/dashboard/system-users" />
      </div>

      {/* User Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>Update user account information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => {
                    setFormData({ ...formData, first_name: e.target.value });
                    if (errors.first_name) {
                      setErrors((prev) => ({ ...prev, first_name: "" }));
                    }
                  }}
                  placeholder="John"
                  maxLength={50}
                  className={errors.first_name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => {
                    setFormData({ ...formData, last_name: e.target.value });
                    if (errors.last_name) {
                      setErrors((prev) => ({ ...prev, last_name: "" }));
                    }
                  }}
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }
                }}
                placeholder="user@thrive.com"
                maxLength={255}
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
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
                    <>
                      {!hasSelectedJobTitleInOptions && formData.job_title_id && (
                        <>
                          <SelectItem value={formData.job_title_id}>
                            {currentJobTitleLabel}
                          </SelectItem>
                          <Separator className="my-1" />
                        </>
                      )}
                      {jobTitles.map((jobTitle: { id?: number | string; name?: string }) => (
                        <SelectItem key={String(jobTitle.id)} value={String(jobTitle.id)}>
                          {jobTitle.name}
                        </SelectItem>
                      ))}
                    </>
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

            <div className="flex justify-end pt-4">
              <Button type="submit" variant="secondary" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Permissions Card */}
      <Card className={permissionError ? "border-destructive" : ""}>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Manage module access permissions for this user
          </CardDescription>
          {permissionError && (
            <p className="text-sm text-destructive mt-1">{permissionError}</p>
          )}
        </CardHeader>
        <CardContent>
          {isLoadingPermissions ? (
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

              {/* Save Permissions Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handlePermissionsSave}
                  disabled={updatePermissionsMutation.isPending}
                >
                  {updatePermissionsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Permissions
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Back Button */}
      <div className="flex gap-4">
        <BackLinkButton href="/dashboard/system-users" label="Back to List" />
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
