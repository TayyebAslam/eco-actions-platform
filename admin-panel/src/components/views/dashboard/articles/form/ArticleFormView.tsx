"use client";

import { useState, useRef, useEffect, useCallback } from "react";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { articlesApi, categoriesApi, schoolsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, FileText, ArrowLeft, Image as ImageIcon, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
const LexicalEditor = dynamic(() => import("@/components/editor/LexicalEditor"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-muted" />,
});
import { PageHeader } from "@/components/layout/PageHeader";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { useAuth } from "@/providers/auth-provider";

/** Upper limit used when fetching all records for dropdowns (avoids pagination). */
const FETCH_ALL_LIMIT = 1000;

interface ArticleFormViewProps {
  articleId?: number;
}

function ArticleFormContent({ articleId }: ArticleFormViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  const requiresSchoolSelection = !user?.school_id;

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    thumbnail_image: "",
    category_id: "",
    points: 10,
    school_id: "global", // 'global' means all schools
  });

  const [thumbnailPreview, setThumbnailPreview] = useState<string>("");
  const [thumbnailError, setThumbnailError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (thumbnailPreview.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [thumbnailPreview]);

  const isEditMode = !!articleId;

  // Fetch article data for edit mode
  const { data: articleData, isLoading: isLoadingArticle } = useQuery({
    queryKey: ["article", articleId],
    queryFn: async () => {
      if (!articleId) return null;
      const response = await articlesApi.getById(articleId);
      return response.data.data;
    },
    enabled: isEditMode,
  });

  // Fetch all categories for dropdown (pass large limit to avoid pagination)
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const response = await categoriesApi.getAll({ limit: FETCH_ALL_LIMIT });
      // The API returns paginated: response.data.data.data or flat array
      const data = response.data.data;
      return Array.isArray(data) ? data : data?.data ?? [];
    },
  });

  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  // Fetch schools (only for users without school_id)
  const { data: schoolsData } = useQuery({
    queryKey: ["schools-list"],
    queryFn: async () => {
      const response = await schoolsApi.getAllSchoolsWithName();
      return response.data.data;
    },
    enabled: requiresSchoolSelection,
  });

  const schools = Array.isArray(schoolsData) ? schoolsData : [];

  // Populate form when editing
  useEffect(() => {
    if (articleData) {
      setFormData({
        title: articleData.title || "",
        content: articleData.content || "",
        thumbnail_image: articleData.thumbnail_image || "",
        category_id: articleData.category_id?.toString() || "",
        points: articleData.points || 10,
        school_id: articleData.school_id?.toString() || "global",
      });
      setThumbnailPreview(articleData.thumbnail_image || "");
    }
  }, [articleData]);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Show instant local preview (revoke old blob URL if exists)
    if (thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    const blobUrl = URL.createObjectURL(file);
    setThumbnailPreview(blobUrl);
    setThumbnailError(false);

    setIsUploadingThumbnail(true);
    try {
      const response = await articlesApi.uploadThumbnail(file);
      const imageUrl = response.data.data.url;
      setFormData((prev) => ({ ...prev, thumbnail_image: imageUrl }));
      if (errors.thumbnail_image) {
        setErrors((prev) => ({ ...prev, thumbnail_image: "" }));
      }
      toast.success("Thumbnail uploaded successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload thumbnail");
      // Revert both preview and formData on failure
      URL.revokeObjectURL(blobUrl);
      setThumbnailPreview(formData.thumbnail_image);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleRemoveThumbnail = () => {
    if (thumbnailPreview.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setFormData((prev) => ({ ...prev, thumbnail_image: "" }));
    setThumbnailPreview("");
  };

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    try {
      const response = await articlesApi.uploadEditorImage(file);
      const imageUrl = 
        response.data.data?.location || 
        response.data.data?.url || 
        response.data?.location || 
        response.data?.url;
      
      if (!imageUrl) {
        throw new Error("Image uploaded but URL not found in response");
      }
      
      return imageUrl;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Image upload failed");
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => articlesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article created successfully");
      router.push("/dashboard/articles");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create article");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => articlesApi.update(articleId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["article", articleId] });
      toast.success("Article updated successfully");
      router.push("/dashboard/articles");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update article");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    const plainContent = formData.content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

    if (!formData.title.trim()) {
      nextErrors.title = "Article title is required";
    }

    if (!formData.thumbnail_image) {
      nextErrors.thumbnail_image = "Thumbnail image is required";
    }

    if (!plainContent) {
      nextErrors.content = "Article content is required";
    }

    if (!formData.category_id) {
      nextErrors.category_id = "Category is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const authorName = user?.first_name && user?.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user?.first_name || "Unknown";

    const submitData: any = {
      title: formData.title,
      content: formData.content,
      thumbnail_image: formData.thumbnail_image,
      category_id: parseInt(formData.category_id),
      points: formData.points,
      author_name: authorName,
    };

    // Add school_id if specified ('global' means all schools)
    if (requiresSchoolSelection && formData.school_id !== "global") {
      submitData.school_id = parseInt(formData.school_id);
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(submitData);
      } else {
        await createMutation.mutateAsync(submitData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditMode && isLoadingArticle) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText className="mr-2 h-8 w-8" />}
        title={isEditMode ? "Edit Article" : "Create Article"}
        description={isEditMode ? "Update article details and content" : "Create a new article with rich content"}
        buttonIcon={<ArrowLeft className="mr-2 h-4 w-4" />}
        buttonText="Back to Articles"
        onButtonClick={() => router.push("/dashboard/articles")}
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <Card>
              <CardHeader>
                <CardTitle>Article Title *</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Enter article title..."
                  value={formData.title}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, title: e.target.value }));
                    if (errors.title) {
                      setErrors((prev) => ({ ...prev, title: "" }));
                    }
                  }}
                  className={`text-base sm:text-lg placeholder:text-base sm:placeholder:text-lg ${errors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {errors.title && <p className="mt-2 text-sm text-destructive">{errors.title}</p>}
              </CardContent>
            </Card>

            {/* Content Editor */}
            <Card>
              <CardHeader>
                <CardTitle>Article Content *</CardTitle>
              </CardHeader>
              <CardContent>
                <LexicalEditor
                  value={formData.content}
                  onChange={(html) => {
                    setFormData((prev) => ({ ...prev, content: html }));
                    if (errors.content) {
                      const plain = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
                      if (plain) {
                        setErrors((prev) => ({ ...prev, content: "" }));
                      }
                    }
                  }}
                  onImageUpload={handleEditorImageUpload}
                />
                {errors.content && <p className="mt-2 text-sm text-destructive">{errors.content}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Thumbnail Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Thumbnail Image *</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {thumbnailPreview ? (
                  <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden">
                    {thumbnailError ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-full h-full object-cover rounded-lg"
                        onError={() => setThumbnailError(true)}
                      />
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveThumbnail}
                      disabled={isUploadingThumbnail}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/40 cursor-pointer transition-colors group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                      disabled={isUploadingThumbnail}
                    />
                    {isUploadingThumbnail ? (
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <ImageIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                          <p className="font-medium text-sm">Upload Thumbnail</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                        </div>
                      </>
                    )}
                  </label>
                )}
                {errors.thumbnail_image && (
                  <p className="text-sm text-destructive">{errors.thumbnail_image}</p>
                )}
              </CardContent>
            </Card>

            {/* Category */}
            <Card>
              <CardHeader>
                <CardTitle>Category *</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  key={`category-${formData.category_id}-${categories.length}`}
                  value={formData.category_id}
                  onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, category_id: value }));
                    if (errors.category_id) {
                      setErrors((prev) => ({ ...prev, category_id: "" }));
                    }
                  }}
                >
                  <SelectTrigger className={errors.category_id ? "border-destructive focus-visible:ring-destructive" : ""}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCategories ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : categories.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        No categories found
                      </div>
                    ) : (
                      categories.map((category: any) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.category_id && <p className="mt-2 text-sm text-destructive">{errors.category_id}</p>}
              </CardContent>
            </Card>

            {/* School Selection (Users without school_id) */}
            {requiresSchoolSelection && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Target Audience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={formData.school_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, school_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span>Global (All Schools)</span>
                        </div>
                      </SelectItem>
                      {schools.map((school: any) => (
                        <SelectItem key={school.id} value={school.id.toString()}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{school.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.school_id !== "global"
                      ? "This article will only be visible to the selected school" 
                      : "This article will be visible to all schools"}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Points */}
            <Card>
              <CardHeader>
                <CardTitle>Points</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  min="0"
                  value={formData.points}
                  onChange={(e) => setFormData((prev) => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground mt-2">Points awarded for reading this article</p>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting || isUploadingThumbnail}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Update Article" : "Create Article"}
            </Button>

          </div>
        </div>
      </form>
    </div>
  );
}

export function ArticleFormView({ articleId }: ArticleFormViewProps) {
  return (
    <PermissionGuard moduleKey="articles">
      <ArticleFormContent articleId={articleId} />
    </PermissionGuard>
  );
}
