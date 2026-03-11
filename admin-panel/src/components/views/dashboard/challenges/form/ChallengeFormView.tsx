"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { challengesApi, categoriesApi, schoolsApi } from "@/lib/api";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil } from "lucide-react";
import { BackLinkButton } from "@/components/ui/back-link-button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { DatePicker } from "@/components/ui/date-picker";
import { PermissionActionGuard } from "@/components/guards/PermissionActionGuard";

/** Format a Date using LOCAL time — avoids UTC off-by-one on positive UTC offsets */
const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Parse a "YYYY-MM-DD" string as a LOCAL date (avoids UTC midnight → prev day shift) */
const parseLocalDate = (str: string): Date => {
  const parts = str.split("-");
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${str}. Expected YYYY-MM-DD`);
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    throw new Error(`Invalid date values in: ${str}`);
  }
  return new Date(y, m - 1, d);
};

/** Return a new Date that is `days` calendar days after `date` (local time) */
const addLocalDays = (date: Date, days: number): Date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return result;
};

const variantSchema = z.object({
  target_count: z.string().refine((val) => !val || /^\d+$/.test(val) && Number(val) >= 1 && Number(val) <= 999999, {
    message: "Target count must be a whole number between 1 and 999,999",
  }),
  target_unit: z.string().max(50, "Target unit must not exceed 50 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters"),
  points: z.string().refine((val) => !val || /^\d+$/.test(val) && Number(val) >= 1 && Number(val) <= 999999, {
    message: "Points must be a whole number between 1 and 999,999",
  }),
}).superRefine((data, ctx) => {
  const hasAnyField = data.target_count || data.target_unit || data.description || data.points;
  if (hasAnyField) {
    if (!data.target_count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target count is required",
        path: ["target_count"],
      });
    }
    if (!data.target_unit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Target unit is required",
        path: ["target_unit"],
      });
    }
    if (!data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description is required",
        path: ["description"],
      });
    }
    if (!data.points) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Points reward is required",
        path: ["points"],
      });
    }
  }
});

const challengeSchema = z.object({
  title: z.string().min(1, "Challenge name is required").max(255, "Challenge name must not exceed 255 characters"),
  description: z.string().min(1, "Challenge description is required").max(2000, "Description must not exceed 2000 characters"),
  category_id: z.string().min(1, "Category is required"),
  is_active: z.enum(["active", "inactive"], { message: "Status is required" }),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  school_id: z.string().optional(),
  easy: variantSchema,
  medium: variantSchema,
  hard: variantSchema,
}).superRefine((data, ctx) => {
  // end_date must be strictly after start_date
  if (data.start_date && data.end_date && data.end_date <= data.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after the start date",
      path: ["end_date"],
    });
  }

  const hasEasy = data.easy.target_count || data.easy.target_unit || data.easy.description || data.easy.points;
  const hasMedium = data.medium.target_count || data.medium.target_unit || data.medium.description || data.medium.points;
  const hasHard = data.hard.target_count || data.hard.target_unit || data.hard.description || data.hard.points;
  const hasAtLeastOneVariant = hasEasy || hasMedium || hasHard;

  // Show inline field-level errors in the variant section when all variants are empty.
  if (!hasAtLeastOneVariant) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Target count is required",
      path: ["easy", "target_count"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Target unit is required",
      path: ["easy", "target_unit"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Description is required",
      path: ["easy", "description"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Points reward is required",
      path: ["easy", "points"],
    });
  }
});

type FormValues = z.infer<typeof challengeSchema>;

/** Upper limit used when fetching all records for dropdowns (avoids pagination). */
const FETCH_ALL_LIMIT = 1000;

export function ChallengeFormView() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const challengeId = params?.id as string | undefined;
  const isViewMode = !!challengeId && searchParams?.get("mode") === "view";
  const isEditMode = !!challengeId && !isViewMode;
  const requiresSchoolSelection = !user?.school_id;
  const userSchoolId = user?.school_id;
  const [variantRequirementError, setVariantRequirementError] = useState("");

  // Determine required permission action based on mode
  const requiredAction = isViewMode ? "can_read" : isEditMode ? "can_edit" : "can_create";

  // Fetch categories
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const response = await categoriesApi.getAll({ limit: FETCH_ALL_LIMIT });
      const data = response.data.data;
      return Array.isArray(data) ? data : data?.data ?? [];
    },
  });

  // Fetch schools
  const { data: schoolsData, isLoading: isLoadingSchools } = useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });

  const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData?.data || []);
  const schools = requiresSchoolSelection
    ? [{ id: "all", name: "All Schools" }, ...(schoolsData || [])]
    : schoolsData || [];

  // Fetch challenge data for edit or view mode
  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge", challengeId],
    queryFn: async () => {
      const response = await challengesApi.getById(Number(challengeId));
      return response.data.data;
    },
    enabled: isEditMode || isViewMode,
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: isViewMode ? undefined : zodResolver(challengeSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      is_active: "active",
      start_date: "",
      end_date: "",
      school_id: requiresSchoolSelection ? "all" : String(userSchoolId || ""),
      easy: {
        target_count: "",
        target_unit: "",
        description: "",
        points: "",
      },
      medium: {
        target_count: "",
        target_unit: "",
        description: "",
        points: "",
      },
      hard: {
        target_count: "",
        target_unit: "",
        description: "",
        points: "",
      },
    },
  });

  const categoryId = watch("category_id");

  // Determine available variants in view mode
  const availableVariants = isViewMode && challenge?.variants
    ? challenge.variants.map((v: any) => v.name)
    : ["easy", "medium", "hard"];

  // Set default active tab to first available variant
  const [activeTab, setActiveTab] = useState(availableVariants[0] || "easy");

  // Update active tab when challenge data loads
  useEffect(() => {
    if (isViewMode && challenge?.variants && availableVariants.length > 0) {
      setActiveTab(availableVariants[0]);
    }
  }, [challenge?.id, isViewMode]);

  // Populate form with challenge data in edit or view mode
  useEffect(() => {
    if (challenge && (isEditMode || isViewMode) && categories.length > 0 && schools.length > 0) {
      const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      // Find variants by name
      const easyVariant = challenge.variants?.find((v: any) => v.name === "easy");
      const mediumVariant = challenge.variants?.find((v: any) => v.name === "medium");
      const hardVariant = challenge.variants?.find((v: any) => v.name === "hard");

      const formData = {
        title: challenge.title || "",
        description: challenge.description || "",
        category_id: String(challenge.category_id || ""),
        is_active: (challenge.is_active ? "active" : "inactive") as "active" | "inactive",
        start_date: challenge.start_date ? formatDate(challenge.start_date) : "",
        end_date: challenge.end_date ? formatDate(challenge.end_date) : "",
        school_id: challenge.school_id ? String(challenge.school_id) : "all",
        easy: {
          target_count: easyVariant ? String(easyVariant.target_count) : "",
          target_unit: easyVariant?.target_unit || "",
          description: easyVariant?.description || "",
          points: easyVariant ? String(easyVariant.points) : "",
        },
        medium: {
          target_count: mediumVariant ? String(mediumVariant.target_count) : "",
          target_unit: mediumVariant?.target_unit || "",
          description: mediumVariant?.description || "",
          points: mediumVariant ? String(mediumVariant.points) : "",
        },
        hard: {
          target_count: hardVariant ? String(hardVariant.target_count) : "",
          target_unit: hardVariant?.target_unit || "",
          description: hardVariant?.description || "",
          points: hardVariant ? String(hardVariant.points) : "",
        },
      };

      reset(formData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, isEditMode, isViewMode]);

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const variants = [];

      if (data.easy.target_count && data.easy.target_unit && data.easy.description && data.easy.points) {
        variants.push({
          name: "easy",
          target_count: Number(data.easy.target_count),
          target_unit: data.easy.target_unit,
          description: data.easy.description,
          points: Number(data.easy.points),
        });
      }
      
      if (data.medium.target_count && data.medium.target_unit && data.medium.description && data.medium.points) {
        variants.push({
          name: "medium",
          target_count: Number(data.medium.target_count),
          target_unit: data.medium.target_unit,
          description: data.medium.description,
          points: Number(data.medium.points),
        });
      }
      
      if (data.hard.target_count && data.hard.target_unit && data.hard.description && data.hard.points) {
        variants.push({
          name: "hard",
          target_count: Number(data.hard.target_count),
          target_unit: data.hard.target_unit,
          description: data.hard.description,
          points: Number(data.hard.points),
        });
      }

      const formattedData: any = {
        title: data.title,
        description: data.description,
        category_id: Number(data.category_id),
        is_active: data.is_active === "active",
        start_date: data.start_date,
        end_date: data.end_date,
        variants,
      };
      
      if (requiresSchoolSelection && data.school_id !== "all") {
        formattedData.school_id = Number(data.school_id);
      } else if (!requiresSchoolSelection) {
        formattedData.school_id = Number(userSchoolId);
      }
      
      return isEditMode
        ? challengesApi.update(Number(challengeId), formattedData)
        : challengesApi.create(formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      if (isEditMode) {
        queryClient.invalidateQueries({ queryKey: ["challenge", challengeId] });
      }
      toast.success(isEditMode ? "Challenge updated successfully" : "Challenge created successfully");
      router.push("/dashboard/challenges");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || (isEditMode ? "Failed to update challenge" : "Failed to create challenge"));
    },
  });

  const onSubmit = (values: FormValues) => {
    setVariantRequirementError("");
    createMutation.mutate(values);
  };

  const hasAtLeastOneVariantFilled = (values: FormValues) => {
    const hasEasy = values.easy.target_count || values.easy.target_unit || values.easy.description || values.easy.points;
    const hasMedium = values.medium.target_count || values.medium.target_unit || values.medium.description || values.medium.points;
    const hasHard = values.hard.target_count || values.hard.target_unit || values.hard.description || values.hard.points;
    return Boolean(hasEasy || hasMedium || hasHard);
  };

  const onInvalidSubmit = () => {
    const values = getValues();
    if (!hasAtLeastOneVariantFilled(values)) {
      setVariantRequirementError("At least one difficulty variant must be completely filled.");
      return;
    }
    setVariantRequirementError("");
  };

  useEffect(() => {
    if (!variantRequirementError) return;
    const values = getValues();
    if (hasAtLeastOneVariantFilled(values)) {
      setVariantRequirementError("");
    }
  }, [
    variantRequirementError,
    getValues,
    watch("easy.target_count"),
    watch("easy.target_unit"),
    watch("easy.description"),
    watch("easy.points"),
    watch("medium.target_count"),
    watch("medium.target_unit"),
    watch("medium.description"),
    watch("medium.points"),
    watch("hard.target_count"),
    watch("hard.target_unit"),
    watch("hard.description"),
    watch("hard.points"),
  ]);

  const renderVariantForm = (difficulty: "easy" | "medium" | "hard") => {
    const selectedCategory = categories.find((c: any) => c.id === Number(categoryId));
    const availableUnits = selectedCategory?.units || [];

    // Get variant data for view mode
    const variantData = isViewMode ? challenge?.variants?.find((v: any) => v.name === difficulty) : null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Target Count *</Label>
            {isViewMode ? (
              <p className="text-sm font-medium py-2">{variantData?.target_count || "N/A"}</p>
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  {...register(`${difficulty}.target_count`)}
                  placeholder="e.g., 30"
                  className={errors[difficulty]?.target_count ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors[difficulty]?.target_count && (
                  <p className="text-sm text-destructive mt-1">
                    {errors[difficulty]?.target_count?.message || "Target count is required"}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Target Unit *</Label>
            {isViewMode ? (
              <p className="text-sm py-2 break-words">{variantData?.target_unit || "N/A"}</p>
            ) : (
              <Controller
                control={control}
                name={`${difficulty}.target_unit`}
                render={({ field }) => (
                  <Select
                    key={`${difficulty}-unit-${field.value}`}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!categoryId || availableUnits.length === 0}
                  >
                    <SelectTrigger className={errors[difficulty]?.target_unit ? "border-destructive focus-visible:ring-destructive" : ""}>
                      <SelectValue placeholder={categoryId ? (availableUnits.length > 0 ? "Select unit" : "No units defined") : "Select category first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((unit: string) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors[difficulty]?.target_unit && (
              <p className="text-sm text-destructive mt-1">
                {errors[difficulty]?.target_unit?.message || "Target unit is required"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description *</Label>
          {isViewMode ? (
            <p className="text-sm leading-relaxed py-2 break-words">{variantData?.description || "N/A"}</p>
          ) : (
            <>
              <Textarea
                {...register(`${difficulty}.description`)}
                placeholder="What should users do for this difficulty level?"
                rows={3}
                maxLength={500}
                className={errors[difficulty]?.description ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              <div className="flex justify-between">
                {errors[difficulty]?.description ? (
                  <p className="text-sm text-destructive mt-1">
                    {errors[difficulty]?.description?.message || "Description is required"}
                  </p>
                ) : <span />}
                <p className="text-xs text-muted-foreground mt-1">
                  {(watch(`${difficulty}.description`) || "").length}/500
                </p>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Points Reward *</Label>
          {isViewMode ? (
            <div className="py-2">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {variantData?.points ? `${variantData.points} points` : "N/A"}
              </Badge>
            </div>
          ) : (
            <>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                {...register(`${difficulty}.points`)}
                placeholder="e.g., 100"
                className={errors[difficulty]?.points ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors[difficulty]?.points && (
                <p className="text-sm text-destructive mt-1">
                  {errors[difficulty]?.points?.message || "Points reward is required"}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoadingCategories || isLoadingSchools || ((isEditMode || isViewMode) && isLoading)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <BackLinkButton href="/dashboard/challenges" />
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
    <PermissionActionGuard moduleKey="challenges" action={requiredAction}>
    <div className="space-y-6 max-w-full">
      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
        <div>
          <div className="flex items-center gap-3 max-[640px]:flex-wrap">
            <h1 className="text-2xl font-bold leading-tight">
              {isViewMode ? "View Challenge" : isEditMode ? "Edit Challenge" : "Create Challenge"}
            </h1>
            {isViewMode && challenge && (
              <Badge variant={challenge.is_active ? "success" : "secondary"}>
                {challenge.is_active ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {isViewMode 
              ? "View challenge details and difficulty variants" 
              : isEditMode 
              ? "Update challenge information and difficulty variants" 
              : "Create a new sustainability challenge with difficulty variants"}
          </p>
        </div>
        <div className="flex items-center gap-3 max-[640px]:w-full max-[640px]:gap-2 max-[480px]:flex-col">
          <BackLinkButton
            href="/dashboard/challenges"
            className="max-[640px]:h-9 max-[640px]:py-2 max-[640px]:flex-1 max-[640px]:justify-center max-[480px]:w-full"
          />
          {isViewMode && (
            <Button
              className="max-[640px]:h-9 max-[640px]:flex-1 max-[640px]:px-3 max-[640px]:text-sm max-[480px]:w-full"
              onClick={() => router.push(`/dashboard/challenges/${challengeId}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4 max-[360px]:mr-1" />
              <span className="max-[360px]:hidden">Edit Challenge</span>
              <span className="hidden max-[360px]:inline">Edit</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="w-full max-w-full overflow-hidden">
        <CardHeader>
          <CardTitle>Challenge Details</CardTitle>
          <CardDescription>
            {isViewMode 
              ? "Challenge overview and configuration" 
              : isEditMode 
              ? "Update the challenge information and configure difficulty variants." 
              : "Fill in the challenge information and configure difficulty variants."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6 w-full">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Challenge Name *</Label>
                {isViewMode ? (
                  <p className="text-sm font-medium py-2 break-words">{challenge?.title || "N/A"}</p>
                ) : (
                  <>
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="e.g., 30-Day Recycling Challenge"
                      maxLength={255}
                      className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive mt-1">{errors.title.message}</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                {isViewMode ? (
                  <p className="text-sm py-2 break-words">{challenge?.category_name || "N/A"}</p>
                ) : (
                  <Controller
                    control={control}
                    name="category_id"
                    render={({ field }) => (
                      <Select
                        key={`category-${field.value}`}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset all target units when category changes
                          setValue("easy.target_unit", "");
                          setValue("medium.target_unit", "");
                          setValue("hard.target_unit", "");
                        }}
                      >
                        <SelectTrigger className={errors.category_id ? "border-destructive focus-visible:ring-destructive" : ""}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category: any) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                {errors.category_id && (
                  <p className="text-sm text-destructive mt-1">{errors.category_id.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                {isViewMode ? (
                  <div className="py-2">
                    <Badge variant={challenge?.is_active ? "success" : "secondary"}>
                      {challenge?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ) : (
                  <Controller
                    control={control}
                    name="is_active"
                    render={({ field }) => (
                      <Select key={`status-${field.value}`} value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.is_active ? "border-destructive focus-visible:ring-destructive" : ""}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                {errors.is_active && (
                  <p className="text-sm text-destructive mt-1">{errors.is_active.message}</p>
                )}
              </div>

              {requiresSchoolSelection ? (
                <div className="space-y-2">
                  <Label>School *</Label>
                  {isViewMode ? (
                    <p className="text-base py-2 break-words">{challenge?.school_name || "All Schools"}</p>
                  ) : (
                    <>
                      <Controller
                        control={control}
                        name="school_id"
                        render={({ field }) => (
                          <Select key={`school-${field.value}`} value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className={errors.school_id ? "border-destructive focus-visible:ring-destructive" : ""}>
                              <SelectValue placeholder="Select school" />
                            </SelectTrigger>
                            <SelectContent>
                              {schools.map((school: any) => (
                                <SelectItem key={school.id} value={String(school.id)}>
                                  {school.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.school_id && (
                        <p className="text-sm text-destructive mt-1">{errors.school_id.message}</p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>School</Label>
                  {isViewMode ? (
                    <p className="text-sm py-2 break-words">{challenge?.school_name || "All Schools"}</p>
                  ) : (
                    <>
                      <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                        {schools.find((s: any) => s.id === userSchoolId)?.name || "Your School"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Challenge will be created for your school
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Challenge Description *</Label>
              {isViewMode ? (
                <p className="text-sm leading-relaxed py-2 break-words">{challenge?.description || "N/A"}</p>
              ) : (
                <>
                  <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Describe the challenge goals and what participants should do..."
                    rows={4}
                    maxLength={2000}
                    className={errors.description ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  <div className="flex justify-between">
                    {errors.description ? (
                      <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                    ) : <span />}
                    <p className="text-xs text-muted-foreground mt-1">
                      {(watch("description") || "").length}/2000
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                {isViewMode ? (
                  <p className="text-sm py-2">
                    {challenge?.start_date ? new Date(challenge.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                  </p>
                ) : (
                  <>
                    <Controller
                      control={control}
                      name="start_date"
                      render={({ field }) => (
                        <DatePicker
                          value={field.value ? parseLocalDate(field.value) : undefined}
                          onChange={(date) => {
                            const newStart = date ? toLocalDateStr(date) : "";
                            field.onChange(newStart);
                            // Clear end_date if it is no longer after the new start date
                            const currentEnd = watch("end_date");
                            if (currentEnd && currentEnd <= newStart) {
                              setValue("end_date", "", { shouldValidate: true });
                            }
                          }}
                          placeholder="Select start date"
                          minDate={new Date()}
                        />
                      )}
                    />
                    {errors.start_date && (
                      <p className="text-sm text-destructive mt-1">{errors.start_date.message}</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                {isViewMode ? (
                  <p className="text-sm py-2">
                    {challenge?.end_date ? new Date(challenge.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                  </p>
                ) : (
                  <>
                    <Controller
                      control={control}
                      name="end_date"
                      render={({ field }) => {
                        const startDateValue = watch("start_date");
                        // end date must be strictly after start date — add 1 calendar day (local)
                        const minEndDate = startDateValue
                          ? addLocalDays(parseLocalDate(startDateValue), 1)
                          : addLocalDays(new Date(), 1);
                        return (
                          <DatePicker
                            value={field.value ? parseLocalDate(field.value) : undefined}
                            onChange={(date) => {
                              field.onChange(date ? toLocalDateStr(date) : "");
                            }}
                            placeholder="Select end date"
                            minDate={minEndDate}
                          />
                        );
                      }}
                    />
                    {errors.end_date && (
                      <p className="text-sm text-destructive mt-1">{errors.end_date.message}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Variants Tabs */}
            <div className="space-y-4">
              <div className="space-y-2">
                <CardTitle>Challenge Variants</CardTitle>
                <CardDescription>Configure at least one difficulty level. You can skip variants you don't need.</CardDescription>
                {variantRequirementError && (
                  <p className="text-sm text-destructive">{variantRequirementError}</p>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger 
                    value="easy" 
                    disabled={isViewMode && !availableVariants.includes("easy")}
                    className="relative"
                  >
                    Easy
                    {errors.easy && Object.keys(errors.easy).length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="medium" 
                    disabled={isViewMode && !availableVariants.includes("medium")}
                    className="relative"
                  >
                    Medium
                    {errors.medium && Object.keys(errors.medium).length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="hard" 
                    disabled={isViewMode && !availableVariants.includes("hard")}
                    className="relative"
                  >
                    Hard
                    {errors.hard && Object.keys(errors.hard).length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="easy" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      {renderVariantForm("easy")}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="medium" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      {renderVariantForm("medium")}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="hard" className="mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      {renderVariantForm("hard")}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {!isViewMode && (
              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push("/dashboard/challenges")}>
                  Cancel
                </Button>
                <Button type="submit" 
                variant="secondary" 
                disabled={isSubmitting || createMutation.isPending || Object.keys(errors).length > 0}>
                  {(isSubmitting || createMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditMode ? "Update Challenge" : "Create Challenge"}
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
