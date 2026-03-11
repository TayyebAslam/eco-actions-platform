"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { teachersApi, schoolsApi } from "@/lib/api";
import { splitFullName } from "@/lib/utils/name";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionActionGuard } from "@/components/guards/PermissionActionGuard";
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
import { Loader2 } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";

const teacherSchema = z.object({
  name: z.string().min(1, "Full name is required").max(100, "Name must not exceed 100 characters"),
  email: z.string().email({ message: "Invalid email address" }).max(255, "Email must not exceed 255 characters"),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), "Phone must contain only numbers"),
  school_id: z.string().min(1, "School is required"),
});

type FormValues = z.infer<typeof teacherSchema>;

export function TeachersCreateView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  
  const requiresSchoolSelection = !user?.school_id;
  const userSchoolId = user?.school_id;

  // Fetch schools only if user doesn't have a school_id
  const { data: schoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["schools-names"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });


  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      school_id: userSchoolId ? String(userSchoolId) : "",
    },
  });

  const selectedSchool = watch("school_id");

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const { first_name, last_name } = splitFullName(data.name);
      return teachersApi.create({
        first_name,
        last_name,
        email: data.email,
        phone: data.phone || undefined,
        school_id: Number(data.school_id),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher created successfully. Password has been sent to their email.");
      router.push("/dashboard/teachers");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create teacher");
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  useEffect(() => {
    // If only one school exists, preselect it
    if (!selectedSchool && schoolsData?.length === 1) {
      setValue("school_id", String(schoolsData[0].id));
    }
  }, [schoolsData, selectedSchool, setValue]);

  return (
    <PermissionActionGuard moduleKey="teachers" action="can_create">
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Create Teacher</h1>
          <p className="text-muted-foreground">Add a new teacher account</p>
        </div>
        <BackLinkButton href="/dashboard/teachers" />
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Teacher Details</CardTitle>
          <CardDescription>Fill in the details to create a new teacher.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" {...register("name")} placeholder="John Doe" maxLength={100} className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""} />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} placeholder="03001234567" maxLength={15} className={errors.phone ? "border-destructive focus-visible:ring-destructive" : ""} />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...register("email")} placeholder="teacher@school.com" maxLength={255} className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""} />
                {errors.email ? (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    A password will be auto-generated and sent to this email address.
                  </p>
                )}
              </div>
            </div>


            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requiresSchoolSelection && (
                <div className="space-y-2">
                  <Label>School *</Label>
                  <Controller
                    control={control}
                    name="school_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a school" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingSchools ? (
                            <div className="p-2 text-sm text-muted-foreground">Loading schools...</div>
                          ) : schoolsData && schoolsData.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">No schools available</div>
                          ) : (
                            schoolsData?.map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.school_id && (
                    <p className="text-sm text-destructive mt-1">{errors.school_id.message}</p>
                  )}
                </div>
              )}

        
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/teachers")} disabled={isSubmitting || createMutation.isPending}>Cancel</Button>
              <Button type="submit" variant="secondary" disabled={isSubmitting || createMutation.isPending}>
                { (isSubmitting || createMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) }
                Create Teacher
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </PermissionActionGuard>
  );
}
