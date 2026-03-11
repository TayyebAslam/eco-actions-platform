"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PermissionActionGuard } from "@/components/guards/PermissionActionGuard";
import { MultiSelect } from "@/components/ui/multi-select";
import { getAllUnitsWithCustom } from "@/lib/units";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").min(2, "Category name must be at least 2 characters").max(100, "Category name must not exceed 100 characters"),
  selectedUnits: z.array(z.string()).nonempty("At least one unit must be selected"),
});

type FormValues = z.infer<typeof categorySchema>;

function CategoryFormContent() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const categoryId = params?.id as string | undefined;
  const isEditMode = !!categoryId;

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Get all available units
  const unitOptions = useMemo(() => getAllUnitsWithCustom(), []);

  // Fetch category data for edit mode
  const { data: category, isLoading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      const response = await categoriesApi.getById(Number(categoryId));
      return response.data.data;
    },
    enabled: isEditMode,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      selectedUnits: [],
    },
  });

  // Populate form with category data in edit mode and sync selected units
  useEffect(() => {
    if (category && isEditMode) {
      reset({
        name: category.name || "",
        selectedUnits: category.units || [],
      });
      setSelectedUnits(category.units || []);
      // ensure react-hook-form has the selected units
      setValue("selectedUnits", category.units || []);
    }
  }, [category, isEditMode, reset, setValue]);

  // Keep react-hook-form in sync when local selectedUnits changes
  useEffect(() => {
    setValue("selectedUnits", selectedUnits);
  }, [selectedUnits, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const formData = new FormData();
      formData.append("name", data.name);
      if (selectedUnits.length > 0) {
        formData.append("units", JSON.stringify(selectedUnits));
      }

      return isEditMode
        ? categoriesApi.update(Number(categoryId), formData)
        : categoriesApi.create(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      }
      toast.success(
        isEditMode
          ? "Category updated successfully"
          : "Category created successfully"
      );
      router.push("/dashboard/categories");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message ||
          (isEditMode
            ? "Failed to update category"
            : "Failed to create category")
      );
    },
  });

  const onSubmit = (values: FormValues) => {
    createMutation.mutate(values);
  };

  if (isEditMode && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <BackLinkButton href="/dashboard/categories" />
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Edit Category" : "Create Category"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? "Update category information and units"
              : "Create a new category with units for challenges"}
          </p>
        </div>
        <BackLinkButton href="/dashboard/categories" />
      </div>

      <Card className="w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>
            {isEditMode
              ? "Update the category information."
              : "Fill in the category information."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., Recycling, Energy Saving"
                  maxLength={100}
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Units *</Label>
                <MultiSelect
                  options={unitOptions}
                  selected={selectedUnits}
                  onChange={setSelectedUnits}
                  placeholder="Select units..."
                  emptyMessage="No units found."
                  groupBy={true}
                  className={errors.selectedUnits ? "border-destructive focus:ring-destructive" : ""}
                />
                {errors.selectedUnits && (
                  <p className="text-sm text-destructive">
                    {errors.selectedUnits.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/categories")}
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

export function CategoryFormView() {
  const params = useParams();
  const isEditMode = !!params?.id;
  const requiredAction = isEditMode ? "can_edit" : "can_create";

  return (
    <PermissionActionGuard moduleKey="categories" action={requiredAction}>
      <CategoryFormContent />
    </PermissionActionGuard>
  );
}
