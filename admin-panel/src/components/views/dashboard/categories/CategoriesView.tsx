"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoriesApi } from "@/lib/api";
import { Category } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Folder } from "lucide-react";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";

function CategoriesContent() {
  const router = useRouter();
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await categoriesApi.getAll();
      // Backend returns: { data: { data: [], page: 1, limit: 10, ... } }
      const paginatedData = response.data.data;
      // Extract the actual array from the paginated response
      return (paginatedData?.data || []) as Category[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted successfully");
      setDeleteCategory(null);
    },
    onError: () => {
      toast.error("Failed to delete category");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Folder className="mr-2 h-8 w-8" />}
        title="Categories"
        description="Manage categories for activities and challenges"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Category"
        onButtonClick={() => router.push("/dashboard/categories/create")}
        buttonDisabled={!canCreate("categories")}
        buttonDisabledTooltip="You don't have permission to create categories"
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories?.map((category) => (
            <Card key={category.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Folder className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium truncate">{category.name}</h3>
                      {category.units && category.units.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {category.units.length} unit{category.units.length > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!canEdit("categories")}
                      onClick={() => {
                        if (canEdit("categories")) {
                          router.push(`/dashboard/categories/${category.id}/edit`);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      disabled={!canDelete("categories")}
                      onClick={() => canDelete("categories") && setDeleteCategory(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteCategory}
        onOpenChange={() => setDeleteCategory(null)}
      >
        <DialogContent className="max-[560px]:w-[calc(100%-1rem)] max-[560px]:max-h-[88dvh] max-[560px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words max-[560px]:text-sm">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteCategory?.name}
            </span>
            ? Activities in this category will need to be reassigned.
          </p>
          <DialogFooter className="max-[560px]:flex-col max-[560px]:gap-2">
            <Button className="max-[560px]:w-full" variant="outline" onClick={() => setDeleteCategory(null)}>
              Cancel
            </Button>
            <Button
              className="max-[560px]:w-full"
              variant="destructive"
              onClick={() =>
                deleteCategory && deleteMutation.mutate(deleteCategory.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CategoriesView() {
  return (
    <PermissionGuard moduleKey="categories">
      <CategoriesContent />
    </PermissionGuard>
  );
}
