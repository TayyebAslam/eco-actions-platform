"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminsApi, schoolsApi, jobTitlesApi, permissionsApi } from "@/lib/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Plus,
  School as SchoolIcon,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/ui/back-link-button";

export function AdminsCreateView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Admin form data
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: isSuperAdmin ? "admin" : "sub_admin",
    job_title_id: "",
    school_id: "",
  });

  // School form data
  const [schoolData, setSchoolData] = useState({
    name: "",
    slug: "",
    address: "",
  });
  const [schoolLogo, setSchoolLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Permissions state
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
  const [permissions, setPermissions] = useState<ModulePermission[]>([]);

  // Job titles (roles) dropdown
  const { data: jobTitles, isLoading: isLoadingJobTitles } = useQuery({
    queryKey: ["job-titles-dropdown"],
    queryFn: async () => {
      const response = await jobTitlesApi.getDropdown();
      return response.data.data;
    },
  });

  // Fetch existing schools for sub_admin assignment
  const { data: schoolsList, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: isSuperAdmin,
  });

  // Fetch all modules for permissions
  const { isLoading: isLoadingModules } = useQuery({
    queryKey: ["modules"],
    queryFn: async () => {
      const response = await permissionsApi.getModules();
      const allModules = response.data.data;
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
    if (errors.school_name) {
      setErrors((prev) => ({ ...prev, school_name: "" }));
    }
    setSchoolData((prev) => ({
      ...prev,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    }));
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

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
          ? { ...p, can_create: checked, can_read: checked, can_edit: checked, can_delete: checked }
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

    // Only require job title when sub_admin is selected
    if (
      formData.role === "sub_admin" &&
      (!formData.job_title_id || formData.job_title_id === "none")
    ) {
      newErrors.job_title_id = "Job title is required";
    }

    if (formData.role === "admin" && !schoolData.name.trim()) {
      newErrors.school_name = "School name is required for admin role";
    }

    if (isSuperAdmin && formData.role === "sub_admin" && (!formData.school_id || formData.school_id === "none")) {
      newErrors.school_id = "School is required for sub-admin";
    }

    // Only validate permissions for sub_admin
    if (formData.role === "sub_admin") {
      const hasAnyPermission = permissions.some(
        (p) => p.can_create || p.can_read || p.can_edit || p.can_delete
      );
      if (!hasAnyPermission) {
        newErrors.permissions = "Please assign at least one permission";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedFirst = formData.first_name.trim();
      const trimmedLast = formData.last_name.trim();
      const trimmedEmail = formData.email.trim();

      let createResponse;

      if (formData.role === "admin") {
        // Step 1: Create school first
        const schoolFormData = new FormData();
        schoolFormData.append("name", schoolData.name.trim());
        if (schoolData.slug) schoolFormData.append("slug", schoolData.slug);
        if (schoolData.address) schoolFormData.append("address", schoolData.address.trim());
        if (schoolLogo) schoolFormData.append("logo", schoolLogo);

        const schoolResponse = await schoolsApi.create(schoolFormData);
        const schoolId = schoolResponse.data.data.id;

        // Step 2: Create admin with school_id (no job_title_id required for admin)
        createResponse = await adminsApi.create({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          email: trimmedEmail,
          role: formData.role,
          school_id: schoolId,
        });
      } else {
        // Create sub_admin with school assignment
        createResponse = await adminsApi.create({
          first_name: trimmedFirst,
          last_name: trimmedLast,
          email: trimmedEmail,
          role: formData.role,
          ...(formData.school_id && formData.school_id !== "none" && { school_id: Number(formData.school_id) }),
          job_title_id: Number(formData.job_title_id),
        });
      }

      // Step 3: Set permissions for sub_admin only (admin gets full permissions by default)
      if (formData.role === "sub_admin") {
        const userId = createResponse.data.data.id;
        await permissionsApi.updateUserPermissions(userId, permissions);
      }

      return createResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      if (formData.role === "admin") {
        queryClient.invalidateQueries({ queryKey: ["schools"] });
      }
      toast.success("Admin created successfully. Password has been sent to their email.");
      router.push("/dashboard/admins");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create admin");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{isSuperAdmin ? "Create School Admin" : "Create System User"}</h1>
          <p className="text-muted-foreground">{isSuperAdmin ? "Add a new school admin or sub-admin" : "Add a new system user"}</p>
        </div>
        <BackLinkButton href="/dashboard/admins" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{isSuperAdmin ? "School Admin Details" : "System User Details"}</CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "Fill in the details to create a new school admin. School information is required only for Admin role."
              : "Fill in the details to create a new system user for your school."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Admin Section - TOP */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">{isSuperAdmin ? "School Admin Information" : "System User Information"}</h3>

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
                    placeholder="admin@school.com"
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
                  <Label htmlFor="role">Role *</Label>
                  {isSuperAdmin ? (
                    <Select
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
                    <Input value="Sub Admin" disabled className="bg-muted" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.role === "sub_admin" && (
                  <div className="space-y-2">
                    <Label htmlFor="job_title_id">Job Title *</Label>
                    <Select
                      value={formData.job_title_id || undefined}
                      onValueChange={(value) => {
                        if (value === "__add_new") {
                          setShowAddRole(true);
                          return;
                        }
                        setFormData((prev) => ({ ...prev, job_title_id: value }));
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
                    {errors.job_title_id ? (
                      <p className="text-sm text-destructive">{errors.job_title_id}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Assign a job title to this user
                      </p>
                    )}
                  </div>
                )}

                {/* Assign to Existing School - show next to Job Title for sub_admin */}
                {isSuperAdmin && formData.role === "sub_admin" && (
                  <div className="space-y-2">
                    <Label htmlFor="school_id">Assign to School *</Label>
                    <Select
                      value={formData.school_id || undefined}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, school_id: value }));
                        if (errors.school_id) {
                          setErrors((prev) => ({ ...prev, school_id: "" }));
                        }
                      }}
                    >
                      <SelectTrigger
                        id="school_id"
                        className={errors.school_id ? "border-destructive focus-visible:ring-destructive" : ""}
                      >
                        <SelectValue placeholder="Select a school" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingSchools ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Loading schools...
                          </div>
                        ) : schoolsList && schoolsList.length > 0 ? (
                          schoolsList.map((school: any) => (
                            <SelectItem key={school.id} value={String(school.id)}>
                              {school.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No schools available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.school_id ? (
                      <p className="text-sm text-destructive">{errors.school_id}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Assign this sub-admin to a school
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Create New School Section - Only show for admin role */}
            {formData.role === "admin" && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">School Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* School Name */}
                  <div className="space-y-2">
                    <Label htmlFor="school_name">School Name *</Label>
                    <Input
                      id="school_name"
                      value={schoolData.name}
                      onChange={(e) => handleSchoolNameChange(e.target.value)}
                      placeholder="Green Valley High School"
                      maxLength={255}
                      aria-describedby={errors.school_name ? "school_name-error" : undefined}
                      className={errors.school_name ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.school_name && (
                      <p id="school_name-error" className="text-sm text-destructive">{errors.school_name}</p>
                    )}
                  </div>

                  {/* Domain/Slug */}
                  <div className="space-y-2">
                    <Label htmlFor="school_slug">Domain / Slug</Label>
                    <Input
                      id="school_slug"
                      value={schoolData.slug}
                      onChange={(e) =>
                        setSchoolData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }))
                      }
                      placeholder="green-valley-high-school"
                      maxLength={255}
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from school name. Used for URL.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* School Logo */}
                  <div className="space-y-2">
                    <Label>School Logo</Label>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-14 w-14 rounded-lg">
                        <AvatarImage src={logoPreview || undefined} className="object-cover" />
                        <AvatarFallback className="rounded-lg bg-primary/10">
                          <SchoolIcon className="h-6 w-6 text-primary" />
                        </AvatarFallback>
                      </Avatar>
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
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* School Address */}
                  <div className="space-y-2">
                    <Label htmlFor="school_address">Address</Label>
                    <Textarea
                      id="school_address"
                      value={schoolData.address}
                      onChange={(e) =>
                        setSchoolData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="123 Eco Street, Green City"
                      maxLength={500}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}


            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admins")}
              >
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
            {isSuperAdmin ? "Create School Admin" : "Create System User"}
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Permissions Card - Only for sub_admin role */}
      {formData.role === "sub_admin" && (
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
      )}

    
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
