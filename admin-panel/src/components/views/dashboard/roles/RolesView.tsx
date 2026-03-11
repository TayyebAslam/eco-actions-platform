"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { jobTitlesApi } from "@/lib/api";
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
import { AlertTriangle, Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";

interface JobTitle {
  id: string;
  name: string;
  description?: string;
  scope?: string;
  created_at: string;
  updated_at: string;
}

function RolesContent() {
  const router = useRouter();
  const [deleteRole, setDeleteRole] = useState<JobTitle | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null); // warning message from backend
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const debouncedSearch = useDebounce(search, 500);
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["job-titles", page, limit, debouncedSearch],
    queryFn: async () => {
      const response = await jobTitlesApi.getAll({
        page: page + 1,
        limit,
        search: debouncedSearch,
      });
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      jobTitlesApi.delete(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-titles"] });
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Job title deleted successfully");
      setDeleteRole(null);
      setDeleteWarning(null);
    },
    onError: (error: any) => {
      const status = error.response?.status;
      const message = error.response?.data?.message || "Failed to delete job title";

      // 409 = conflict, job title is in use - show warning
      if (status === 409) {
        setDeleteWarning(message);
      } else {
        toast.error(message);
      }
    },
  });

  // Only Super Admin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Only Super Admins can manage roles</p>
        </div>
      </div>
    );
  }

  const roles = data?.data || [];
  const totalPages = data?.totalPages || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ShieldCheck className="mr-2 h-8 w-8" />}
        title="Job Title"
        description="Manage job titles and roles for system users"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add Job Title"
        onButtonClick={() => router.push("/dashboard/roles/create")}
      />

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {roles.map((role: JobTitle) => (
              <Card key={role.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3 max-[420px]:flex-col">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{role.name}</h3>
                          {role.scope && (
                            <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full mt-1 ${
                              role.scope === "global"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : role.scope === "system"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            }`}>
                              {role.scope === "global" ? "Global" : role.scope === "system" ? "System" : "School"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1 max-[420px]:w-full max-[420px]:justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/dashboard/roles/${role.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteRole(role)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {role.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {role.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteRole} onOpenChange={() => { setDeleteRole(null); setDeleteWarning(null); }}>
        <DialogContent className="max-[560px]:w-[calc(100%-1rem)] max-[560px]:max-h-[88dvh] max-[560px]:p-4">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-left">Delete Job Title</DialogTitle>
          </DialogHeader>

          {deleteWarning ? (
            <>
              <div className="flex items-start max-w-[400px] gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Warning</p>
                  <p className="text-sm text-muted-foreground">{deleteWarning}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to proceed? This action cannot be undone.
              </p>
              <DialogFooter className="max-[560px]:flex-col max-[560px]:gap-2">
                <Button className="max-[560px]:w-full" variant="outline" onClick={() => { setDeleteRole(null); setDeleteWarning(null); }}>
                  Cancel
                </Button>
                <Button
                  className="max-[560px]:w-full"
                  variant="destructive"
                  onClick={() => deleteRole && deleteMutation.mutate({ id: deleteRole.id, force: true })}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete Anyway
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-muted-foreground break-words break-all max-[560px]:text-sm">
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground ">
                  {deleteRole?.name}
                </span>
                ?
              </p>
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground break-words  ">
                  If this job title is assigned to any users, they will be <span className="font-medium text-foreground">deactivated</span>. This action cannot be undone.
                </p>
              </div>
              <DialogFooter className="max-[560px]:flex-col max-[560px]:gap-2">
                <Button className="max-[560px]:w-full" variant="outline" onClick={() => setDeleteRole(null)}>
                  Cancel
                </Button>
                <Button
                  className="max-[560px]:w-full"
                  variant="destructive"
                  onClick={() => deleteRole && deleteMutation.mutate({ id: deleteRole.id })}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RolesView() {
  return <RolesContent />;
}
