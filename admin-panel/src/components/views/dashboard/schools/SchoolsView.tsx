"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolsApi } from "@/lib/api";
import { Schools } from "@/types";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  School as SchoolIcon,
  Users,
  GraduationCap,
  Search,
  Building2,
  Sparkles,
  AlertTriangle,
  School,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import { SuperAdminGuard } from "@/components/guards/SuperAdminGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import type { SubscriptionStatus } from "@/lib/school-status-utils";
import { parseSubscriptionStatus, normalizeSchoolStatus } from "@/lib/school-status-utils";


function SchoolsContent() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [deleteSchool, setDeleteSchool] = useState<Schools | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  // track a pending status change that requires confirmation
  const [pendingStatus, setPendingStatus] = useState<{ id: number; status: SubscriptionStatus } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["schools", page, limit, debouncedSearch],
    queryFn: async () => {
      const response = await schoolsApi.getAll({
        page: page + 1,
        limit: limit,
        search: debouncedSearch || undefined,
      });
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => schoolsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School deleted successfully");
      setDeleteSchool(null);
    },
    onError: () => {
      toast.error("Failed to delete school");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SubscriptionStatus }) => {
      const data = new FormData();
      data.append("subscription_status", status);
      data.append("status", status);
      data.append("is_active", status === "active" ? "1" : "0");
      return schoolsApi.update(id, data);
    },
    onSuccess: (_, variables) => {
      // clear any locally stored override now that the server update succeeded
      if (typeof window !== "undefined") {
        localStorage.removeItem(`school-status-override-${variables.id}`);
      }
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      queryClient.invalidateQueries({ queryKey: ["school", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["school"] });
      toast.success("School status updated");
      setUpdatingStatusId(null);
    },
    onError: (_, variables) => {
      // revert the optimistic localStorage override on failure
      if (typeof window !== "undefined") {
        localStorage.removeItem(`school-status-override-${variables.id}`);
      }
      toast.error("Failed to update status");
      setUpdatingStatusId(null);
    },
  });

  const columns: ColumnDef<Schools>[] = [
    {
      accessorKey: "name",
      header: "School",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const school = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 rounded-xl border-2 border-purple-100 dark:border-purple-900">
              <AvatarImage src={school.logo_url} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white">
                <SchoolIcon className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{school.name}</p>
              {school.address && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 max-w-[200px]">
                  {school.address}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "staff_count",
      header: "Stats",
      enableSorting: true,
      sortingFn: "basic",
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg">
            <GraduationCap className="h-3.5 w-3.5" />
            <span className="font-medium">{row.original.staff_count || 0}</span>
            <span className="text-blue-500 dark:text-blue-400 text-xs">Staff</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
            <Users className="h-3.5 w-3.5" />
            <span className="font-medium">{row.original.students_count || 0}</span>
            <span className="text-emerald-500 dark:text-emerald-400 text-xs">students</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "subscription_status",
      header: "Status",
      size: 160,
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const effectiveStatus = normalizeSchoolStatus(row.original);
        return (
        <div className="w-[150px]">
          <Select
            value={effectiveStatus}
            onValueChange={(value: SubscriptionStatus) => {
              // require confirmation for potentially destructive transitions
              if (value === "inactive" || value === "suspended") {
                setPendingStatus({ id: row.original.id, status: value });
                return;
              }
              applyStatusChange(row.original.id, value);
            }}
            disabled={updateStatusMutation.isPending && updatingStatusId === row.original.id}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )},
    },
    {
      accessorKey: "created_at",
      header: "Created",
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5">
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
              <Link href={`/dashboard/schools/${row.original.id}?mode=view`} className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-500" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const statusForEdit =
                  typeof window !== "undefined"
                    ? localStorage.getItem(`school-status-override-${row.original.id}`) || normalizeSchoolStatus(row.original)
                    : normalizeSchoolStatus(row.original);
                router.push(
                  `/dashboard/schools/${row.original.id}/edit?status=${encodeURIComponent(statusForEdit)}`
                );
              }}
              className="rounded-lg cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4 text-gray-500" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => setDeleteSchool(row.original)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // helper to actually perform the status change once confirmed
  const applyStatusChange = (id: number, value: SubscriptionStatus) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`school-status-override-${id}`, value);
    }
    setUpdatingStatusId(id);
    updateStatusMutation.mutate({ id, status: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={<School className="mr-2 h-8 w-8" />}
        title="Schools"
        description="Manage schools in the ecosystem"
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText="Add School"
        onButtonClick={() => router.push("/dashboard/schools/create")}
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search schools by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="">
        <DataTable
          columns={columns}
          data={data?.data || []}
          isLoading={isLoading}
          pageCount={data?.totalPages || 1}
          pageIndex={page}
          pageSize={limit}
          totalCount={data?.totalCount}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteSchool} onOpenChange={() => setDeleteSchool(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/15">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle className="text-xl">Delete School</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-gray-600 dark:text-gray-400 break-words">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100 break-all">
              {deleteSchool?.name}
            </span>
            ? This will also delete all classes, sections, and student associations.
          </p>
          <DialogFooter className="flex-wrap gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteSchool(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSchool && deleteMutation.mutate(deleteSchool.id)}
              disabled={deleteMutation.isPending}
              className="rounded-xl"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete School
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change confirmation dialog */}
      <Dialog open={!!pendingStatus} onOpenChange={() => setPendingStatus(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/15">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <DialogTitle className="text-xl">Confirm Status Change</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to change the school status to <span className="font-semibold">{pendingStatus?.status}</span>? This will {pendingStatus?.status === "suspended" ? "block all users from accessing the school" : "deactivate the school"}.
          </p>
          <DialogFooter className="flex-wrap gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPendingStatus(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingStatus) {
                  applyStatusChange(pendingStatus.id, pendingStatus.status);
                }
                setPendingStatus(null);
              }}
              className="rounded-xl"
              disabled={updateStatusMutation.isPending && updatingStatusId === pendingStatus?.id}
            >
              {updateStatusMutation.isPending && updatingStatusId === pendingStatus?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SchoolsView() {
  return (
    <SuperAdminGuard>
      <SchoolsContent />
    </SuperAdminGuard>
  );
}
