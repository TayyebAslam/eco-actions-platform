"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jobTitlesApi } from "@/lib/api";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Loader2 } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";

const roleSchema = z.object({
  name: z
    .string()
    .min(1, "Role name is required")
    .min(2, "Role name must be at least 2 characters")
    .max(100, "Role name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  scope: z.enum(["global", "system", "school"]),
});

type FormValues = z.infer<typeof roleSchema>;
type RoleScope = FormValues["scope"];
const VALID_SCOPES: RoleScope[] = ["global", "system", "school"];

const normalizeRoleScope = (value: unknown): RoleScope => {
  if (typeof value !== "string") return "global";

  const scope = value.trim().toLowerCase();
  if (scope === "global" || scope === "system" || scope === "school") {
    return scope;
  }

  // Backward compatibility for older payloads that used "all".
  if (scope === "all") return "global";

  return "global";
};

function RoleFormContent() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const roleId = params?.id as string | undefined;
  const isEditMode = !!roleId;

  // Fetch role data for edit mode
  const { data: role, isLoading } = useQuery({
    queryKey: ["job-title", roleId],
    queryFn: async () => {
      const response = await jobTitlesApi.getById(roleId!);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      scope: "global",
    },
  });

  const selectedScope = watch("scope");
  const roleScope = normalizeRoleScope(role?.scope);
  const effectiveScope = selectedScope ?? roleScope;

  // Some API responses/UI flows can leave scope as an empty string in RHF state.
  // Force it back to a valid enum value so Select can render the saved option.
  useEffect(() => {
    if (!selectedScope || !VALID_SCOPES.includes(selectedScope as RoleScope)) {
      setValue("scope", roleScope, { shouldDirty: false, shouldValidate: false });
    }
  }, [selectedScope, roleScope, setValue]);

  // Populate form with role data in edit mode
  useEffect(() => {
    if (role && isEditMode) {
      const normalizedScope = normalizeRoleScope(role.scope);
      reset({
        name: role.name || "",
        description: role.description || "",
        scope: normalizedScope,
      });
      setValue("scope", normalizedScope, { shouldDirty: false, shouldValidate: false });
    }
  }, [role, isEditMode, reset, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload: { name: string; description?: string; scope?: "global" | "system" | "school" } = {
        name: data.name,
        scope: normalizeRoleScope(data.scope ?? role?.scope),
      };
      if (data.description) {
        payload.description = data.description;
      }

      return isEditMode
        ? jobTitlesApi.update(roleId!, payload)
        : jobTitlesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-titles"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["job-title", roleId] });
      }
      toast.success(
        isEditMode ? "Role updated successfully" : "Role created successfully"
      );
      router.push("/dashboard/roles");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? "Failed to update role" : "Failed to create role")
      );
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  // Only Super Admin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            Only Super Admins can manage roles
          </p>
        </div>
      </div>
    );
  }

  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <BackLinkButton href="/dashboard/roles" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Edit Role" : "Create Role"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? "Update role information"
              : "Create a new job title for system users"}
          </p>
        </div>
        <BackLinkButton href="/dashboard/roles" />
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Role Details</CardTitle>
          <CardDescription>
            {isEditMode
              ? "Update the role information."
              : "Fill in the role information."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Role Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., System Administrator, Content Manager"
                  maxLength={100}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Scope *</Label>
                <Controller
                  name="scope"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={VALID_SCOPES.includes((field.value as RoleScope) || roleScope) ? ((field.value as RoleScope) || roleScope) : roleScope}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (Everyone)</SelectItem>
                        <SelectItem value="system">System (Super Admin users)</SelectItem>
                        <SelectItem value="school">School (School Admin users)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {effectiveScope === "global"
                    ? "Available for all users (system + school)"
                    : effectiveScope === "system"
                    ? "Only for system-level users (Super Admin, Super Sub-Admin)"
                    : "Only for school-level users (Admin, Sub-Admin)"}
                </p>
                {errors.scope && (
                  <p className="text-sm text-destructive">{errors.scope.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Describe the role responsibilities..."
                maxLength={500}
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/roles")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={isSubmitting || createMutation.isPending}
              >
                {(isSubmitting || createMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function RoleFormView() {
  return <RoleFormContent />;
}
