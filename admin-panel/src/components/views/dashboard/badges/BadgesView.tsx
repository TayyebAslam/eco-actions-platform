"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { badgesApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Badge as BadgeType } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Loader2, Award, Users } from "lucide-react";
import { toast } from "sonner";
import { PermissionGuard } from "@/components/guards/PermissionGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";

function BadgesContent() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeType | null>(null);
  const [deleteBadge, setDeleteBadge] = useState<BadgeType | null>(null);
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data: badges, isLoading } = useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const response = await badgesApi.getAll();
      return response.data.data.data as BadgeType[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => badgesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      toast.success("Badge deleted successfully");
      setDeleteBadge(null);
    },
    onError: () => {
      toast.error("Failed to delete badge");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Award className="mr-2 h-8 w-8" />}
        title="Badges"
        description="Manage achievement badges for students"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Badge"
        onButtonClick={() => setIsDialogOpen(true)}
        buttonDisabled={!canCreate("badges")}
        buttonDisabledTooltip="You don't have permission to create badges"
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {badges?.map((badge) => (
            <Card key={badge.id} className="group relative overflow-hidden">
              <CardContent className="p-6 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-yellow-100">
                    {badge.icon_url ? (
                      <Image
                        src={badge.icon_url || ""}
                        alt={badge.name ?? ""}
                        width={32}
                        height={32}
                        className="h-8 w-8"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          e.currentTarget.parentElement?.querySelector('.badge-fallback-icon')?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <Award className={`badge-fallback-icon h-7 w-7 text-yellow-600 ${badge.icon_url ? "hidden" : ""}`} />
                  </div>
                  <div className="flex gap-1 ">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!canEdit("badges")}
                      onClick={() => {
                        if (canEdit("badges")) {
                          setEditingBadge(badge);
                          setIsDialogOpen(true);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 dark:text-red-400 dark:hover:bg-red-500/20"
                      disabled={!canDelete("badges")}
                      onClick={() => canDelete("badges") && setDeleteBadge(badge)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-4 font-semibold truncate">{badge.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2 break-words">
                  {badge.criteria || "No criteria defined"}
                </p>
                <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {badge.students_count || 0} students earned
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <BadgeDialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingBadge(null);
        }}
        badge={editingBadge}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteBadge} onOpenChange={() => setDeleteBadge(null)}>
        <DialogContent className="max-[530px]:w-[calc(100%-1rem)] max-[530px]:max-h-[88dvh] max-[530px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Delete Badge</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words max-[530px]:text-sm">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteBadge?.name}
            </span>
            ? Students who earned this badge will lose it.
          </p>
          <DialogFooter className="max-[530px]:flex-col max-[530px]:gap-2">
            <Button className="max-[530px]:w-full" variant="outline" onClick={() => setDeleteBadge(null)}>
              Cancel
            </Button>
            <Button
              className="max-[530px]:w-full"
              variant="destructive"
              onClick={() =>
                deleteBadge && deleteMutation.mutate(deleteBadge.id)
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

export function BadgesView() {
  return (
    <PermissionGuard moduleKey="badges">
      <BadgesContent />
    </PermissionGuard>
  );
}

function BadgeDialog({
  open,
  onClose,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  badge: BadgeType | null;
}) {
  const [formData, setFormData] = useState({
    name: badge?.name || "",
    criteria: badge?.criteria || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setFormData({
        name: badge?.name || "",
        criteria: badge?.criteria || "",
      });
      setErrors({});
    }
  }, [open, badge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      nextErrors.name = "Badge name is required";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const data = new FormData();
      data.append("name", formData.name.trim());
      data.append("criteria", formData.criteria.trim());

      if (badge) {
        await badgesApi.update(badge.id, data);
        toast.success("Badge updated successfully");
      } else {
        await badgesApi.create(data);
        toast.success("Badge created successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-[530px]:w-[calc(100%-1rem)] max-[530px]:max-h-[88dvh] max-[530px]:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-left">{badge ? "Edit Badge" : "Create Badge"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label>Badge Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: "" }));
                }
              }}
              placeholder="e.g., Eco Warrior, Green Champion"
              maxLength={100}
              className={cn(errors.name ? "border-destructive focus-visible:ring-destructive" : "", "break-words")}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            <p className="text-xs text-muted-foreground text-right">
              {formData.name.length}/100
            </p>
          </div>
          <div className="space-y-2">
            <Label>Criteria</Label>
            <Textarea
              value={formData.criteria}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData({ ...formData, criteria: e.target.value })
              }
              placeholder="e.g., Complete 10 recycling activities"
              maxLength={200}
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.criteria.length}/200
            </p>
          </div>
          <DialogFooter className="max-[530px]:flex-col max-[530px]:gap-2">
            <Button className="max-[530px]:w-full" type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button className="max-[530px]:w-full" type="submit" variant="secondary" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {badge ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
