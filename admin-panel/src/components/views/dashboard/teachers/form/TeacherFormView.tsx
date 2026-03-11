"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teachersApi, schoolsApi } from "@/lib/api";
import { splitFullName } from "@/lib/utils/name";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/auth-provider";
import { PermissionActionGuard } from "@/components/guards/PermissionActionGuard";

// Schema for editing a teacher (no password, no school_id change)
const editTeacherSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100, "Name must not exceed 100 characters"),
  email: z.string().email({ message: "Invalid email address" }).max(255, "Email must not exceed 255 characters"),
  is_active: z.boolean(),
});

type EditFormValues = z.infer<typeof editTeacherSchema>;

export function TeacherFormView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const teacherId = params?.id as string | undefined;
  const isViewMode = !!teacherId && searchParams?.get("mode") === "view";
  const isEditMode = !!teacherId && !isViewMode;

  // Determine required permission action based on mode
  const requiredAction = isViewMode ? "can_read" : "can_edit";


  // Fetch teacher data
  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher", teacherId],
    queryFn: async () => {
      const response = await teachersApi.getById(Number(teacherId));
      return response.data.data;
    },
    enabled: !!teacherId,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: isViewMode ? undefined : zodResolver(editTeacherSchema),
    defaultValues: {
      name: "",
      email: "",
      is_active: true,
    },
  });

  // Populate form with teacher data
  useEffect(() => {
    if (teacher && teacherId) {
      const formData = {
        name: `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim(),
        email: teacher.email || "",
        is_active: teacher.is_active !== false,
      };
      reset(formData);
    }
  }, [teacher?.id, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormValues) => {
      const { first_name, last_name } = splitFullName(data.name);
      const formattedData = {
        first_name,
        last_name,
        email: data.email,
        is_active: data.is_active,
      };
      return teachersApi.update(Number(teacherId), formattedData);
    },


    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", teacherId] });
      toast.success("Teacher updated successfully");
      router.push("/dashboard/teachers");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update teacher");
    },
  });

  const onSubmit = (values: EditFormValues) => {
    updateMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <BackLinkButton href="/dashboard/teachers" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PermissionActionGuard moduleKey="teachers" action={requiredAction}>
      <div className="space-y-6 max-w-full">
        <div className="flex items-start justify-between gap-4 max-[519px]:flex-col">
          <div>
            <div className="flex items-center gap-3 max-[519px]:flex-wrap">
              <h1 className="text-2xl font-bold leading-tight">
                {isViewMode ? "View Teacher" : "Edit Teacher"}
              </h1>
              {isViewMode && teacher && (
                <Badge variant={teacher.is_active ? "success" : "secondary"}>
                  {teacher.is_active ? "Active" : "Inactive"}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isViewMode
                ? "View teacher information"
                : "Update teacher information"}
            </p>
          </div>
          <div className="flex items-center gap-3 max-[519px]:w-full max-[519px]:gap-2">
            <BackLinkButton
              href="/dashboard/teachers"
              className="max-[519px]:h-9 max-[519px]:flex-1 max-[519px]:justify-center"
            />
            {isViewMode && (
              <Button
                className="max-[519px]:h-9 max-[519px]:flex-1"
                onClick={() => router.push(`/dashboard/teachers/${teacherId}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Teacher
              </Button>
            )}
          </div>
        </div>

        <Card className="w-full max-w-full overflow-hidden">
          <CardHeader>
            <CardTitle>Teacher Details</CardTitle>
            <CardDescription>
              {isViewMode
                ? "View the teacher information below."
                : "Update the teacher information below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6 w-full"
            >
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                  <Label htmlFor="name">Full Name *</Label>
                  {isViewMode ? (
                    <p className="text-sm font-medium py-2 break-words">{`${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim() || "N/A"}</p>
                  ) : (
                    <>
                      <Input id="name" {...register("name")} placeholder="e.g., Jane Doe" maxLength={100} className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""} />
                      {errors.name && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.name.message}
                        </p>
                      )}
                    </>
                  )}
                  </div>
                  <div className="">
                    <Label htmlFor="email">Email *</Label>
                    {isViewMode ? (
                      <p className="text-sm py-2 break-words break-all">{teacher?.email || "N/A"}</p>
                    ) : (
                      <>
                        <Input id="email" type="email" {...register("email")} placeholder="teacher@school.com" maxLength={255} className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""} />
                        {errors.email && (
                          <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* School Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">School Information</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>School</Label>
                    <p className="text-sm py-2 break-words">{teacher?.school_name || "N/A"}</p>
                  </div>
                </div>

                {!isViewMode && (
                  <div className="flex items-center space-x-2">
                    <Controller
                      control={control}
                      name="is_active"
                      render={({ field }) => (
                        <Switch
                          id="is_active"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Active Status
                    </Label>
                  </div>
                )}
              </div>

              {!isViewMode && (
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/teachers")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="secondary" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Teacher
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionActionGuard>
  );
}
