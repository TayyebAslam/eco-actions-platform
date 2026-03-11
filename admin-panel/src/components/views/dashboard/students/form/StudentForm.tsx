"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentsApi, schoolsApi, classesApi, sectionsApi } from "@/lib/api";
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
import { Pencil, Loader2 } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/auth-provider";
import { PermissionActionGuard } from "@/components/guards/PermissionActionGuard";

// Schema for creating a student
const createStudentSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address").max(255, "Email must not exceed 255 characters"),
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  school_id: z.string().min(1, "School is required"),
  class_id: z.string().min(1, "Class is required"),
  section_id: z.string().optional(),
});

// Schema for editing a student
const editStudentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  class_id: z.string().min(1, "Class is required"),
  section_id: z.string().optional(),
  is_active: z.boolean(),
});

type CreateFormValues = z.infer<typeof createStudentSchema>;
type EditFormValues = z.infer<typeof editStudentSchema>;

export function StudentFormView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const studentId = params?.id as string | undefined;
  const isEditMode = !!studentId;
  const requiresSchoolSelection = !user?.school_id;
  const userSchoolId = user?.school_id;

  // Determine required permission action based on mode
  const requiredAction = isEditMode ? "can_edit" : "can_create";

  // Fetch schools
  const { data: schoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["schools-names"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: !isEditMode,
  });

  // Fetch classes
  const { data: classesData, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const response = await classesApi.getAllClasses();
      return response.data.data;
    },
  });

  // Fetch student data for edit or view mode
  const { data: student, isLoading } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const response = await studentsApi.getById(Number(studentId));
      return response.data.data;
    },
    enabled: isEditMode,
  });

  const schema = isEditMode ? editStudentSchema : createStudentSchema;

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues | EditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEditMode
      ? {
          name: "",
          class_id: "",
          section_id: "",
          is_active: true,
        }
      : {
          email: "",
          name: "",
          school_id: userSchoolId ? String(userSchoolId) : "",
          class_id: "",
          section_id: "none",
        },
  });

  // Watch class_id for section filtering
  const watchedClassId = watch("class_id" as any);


  // Fetch sections filtered by selected class
  const { data: sectionsData, isLoading: isLoadingSections } = useQuery({
    queryKey: ["sections", watchedClassId],
    queryFn: async () => {
      const response = await sectionsApi.getAll(Number(watchedClassId));
      return response.data.data?.data ?? response.data.data;
    },
    enabled: !!watchedClassId,
  });

  // Populate form with student data in edit mode
  useEffect(() => {
    if (student && isEditMode) {
      const formData = {
        name: student.name || "",
        class_id: String(student.class_id || ""),
        section_id: student.section_id ? String(student.section_id) : "none",
        is_active: student.is_active !== false,
      };
      reset(formData);
    }
  }, [student?.id, isEditMode, reset]);

  // Clear section when class changes (only after initial load)
  const [initialClassId, setInitialClassId] = useState<string | null>(null);
  useEffect(() => {
    if (watchedClassId && initialClassId === null) {
      setInitialClassId(watchedClassId);
    } else if (watchedClassId && initialClassId && watchedClassId !== initialClassId) {
      setValue("section_id" as any, "none");
      setInitialClassId(watchedClassId);
    }
  }, [watchedClassId, initialClassId, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormValues | EditFormValues) => {
      if (isEditMode) {
        const editData = data as EditFormValues;
        const formattedData: Record<string, any> = {
          name: editData.name,
          class_id: Number(editData.class_id),
          is_active: editData.is_active,
        };
        // Include section_id (can be number or null to clear)
        if (editData.section_id && editData.section_id !== "none") {
          formattedData.section_id = Number(editData.section_id);
        } else {
          formattedData.section_id = null;
        }
        return studentsApi.update(Number(studentId), formattedData);
      } else {
        const createData = data as CreateFormValues;
        const formattedData: Record<string, any> = {
          email: createData.email,
          name: createData.name,
          school_id: Number(createData.school_id),
          class_id: Number(createData.class_id),
        };
        // Only include section_id if provided
        if (createData.section_id && createData.section_id !== "none") {
          formattedData.section_id = Number(createData.section_id);
        }
        return studentsApi.create(formattedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      }
      toast.success(
        isEditMode ? "Student updated successfully" : "Student created successfully"
      );
      router.push("/dashboard/students");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode ? "Failed to update student" : "Failed to create student")
      );
    },
  });

  const onSubmit = (values: CreateFormValues | EditFormValues) => {
    createMutation.mutate(values);
  };

  if (
    isLoadingSchools ||
    isLoadingClasses ||
    (isEditMode && isLoading)
  ) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <BackLinkButton href="/dashboard/students" />
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
    <PermissionActionGuard moduleKey="students" action={requiredAction}>
      <div className="space-y-6 max-w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? "Edit Student" : "Create Student"}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode
                ? "Update student information"
                : "Add a new student to the system"}
            </p>
          </div>
          <BackLinkButton href="/dashboard/students" />
        </div>

        <Card className="w-full max-w-full overflow-hidden">
          <CardHeader>
            <CardTitle>Student Details</CardTitle>
            <CardDescription>
              {isEditMode
                ? "Update the student information below."
                : "Fill in the student information below."}
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
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="e.g., John Doe"
                      maxLength={100}
                      className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                {!isEditMode && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="e.g., student@example.com"
                      maxLength={255}
                      className={(errors as any).email ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {(errors as any).email ? (
                      <p className="text-sm text-destructive mt-1">
                        {(errors as any).email?.message}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        A password will be auto-generated and sent to this email address.
                      </p>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Academic Information</h3>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isEditMode && requiresSchoolSelection && (
                    <div className="space-y-2">
                      <Label>School *</Label>
                      <Controller
                        control={control}
                        name="school_id"
                        render={({ field }) => (
                          <Select
                            key={`school-${field.value}`}
                            value={field.value as string}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className={(errors as any).school_id ? "border-destructive focus-visible:ring-destructive" : ""}>
                              <SelectValue placeholder="Select school" />
                            </SelectTrigger>
                            <SelectContent>
                              {schoolsData?.map((school: any) => (
                                <SelectItem key={school.id} value={String(school.id)}>
                                  {school.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {(errors as any).school_id && (
                        <p className="text-sm text-destructive mt-1">
                          {(errors as any).school_id?.message}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Class *</Label>
                    <Controller
                          control={control}
                          name="class_id"
                          render={({ field }) => (
                            <Select
                              key={`class-${field.value}`}
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className={errors.class_id ? "border-destructive focus-visible:ring-destructive" : ""}>
                                <SelectValue placeholder="Select class" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.isArray(classesData) && classesData.map((classItem: any) => (
                                  <SelectItem
                                    key={classItem.id}
                                    value={String(classItem.id)}
                                  >
                                    {classItem.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.class_id && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.class_id.message}
                          </p>
                        )}
                  </div>

                  <div className="space-y-2">
                    <Label>Section (Optional)</Label>
                    <Controller
                      control={control}
                      name="section_id"
                      render={({ field }) => (
                        <Select
                          key={`section-${field.value}-${watchedClassId}`}
                          value={field.value as string}
                          onValueChange={field.onChange}
                          disabled={!watchedClassId || isLoadingSections}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!watchedClassId ? "Select class first" : "Select section"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Section</SelectItem>
                            {Array.isArray(sectionsData) && sectionsData.map((section: any) => (
                              <SelectItem
                                key={section.id}
                                value={String(section.id)}
                              >
                                {section.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {isEditMode && (
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

              <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/students")}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="secondary" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditMode ? "Update Student" : "Create Student"}
                  </Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionActionGuard>
  );
}
