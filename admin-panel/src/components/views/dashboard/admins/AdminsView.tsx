"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { adminsApi } from "@/lib/api";
import { Admin } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, Search, UsersRound, Lock} from "lucide-react";
import { toast } from "sonner";
import { formatDate, getInitials } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";

export function AdminsView() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [deleteAdmin, setDeleteAdmin] = useState<Admin | null>(null);
  const queryClient = useQueryClient();
  const { isSuperAdmin, canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = canCreate("admins");
  const hasEditPermission = canEdit("admins");
  const hasDeletePermission = canDelete("admins");

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["admins", page, limit, debouncedSearch],
    queryFn: async () => {
      const response = await adminsApi.getAll({ page: page + 1, limit: limit, search: debouncedSearch });
      return response.data.data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminsApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Admin status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Admin deleted successfully");
      setDeleteAdmin(null);
    },
    onError: () => {
      toast.error("Failed to delete admin");
    },
  });

  const columns: ColumnDef<Admin>[] = [
    {
      accessorKey: "first_name",
      header: "User",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => {
        const admin = row.original;
        const name = `${admin.first_name || ""} ${admin.last_name || ""}`.trim() || admin.email;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={admin.avatar_url} />
              <AvatarFallback className="text-xs">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      enableSorting: true,
      sortingFn: "text",
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.original.role?.replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      size: 140,
      enableSorting: true,
      sortingFn: "basic",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.original.is_active}
            onCheckedChange={() => hasEditPermission && toggleMutation.mutate(row.original.id)}
            disabled={!hasEditPermission}
          />
          <span className="text-sm text-muted-foreground w-16">
            {row.original.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      enableSorting: true,
      sortingFn: "datetime",
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => hasEditPermission && router.push(`/dashboard/admins/${row.original.id}/edit`)}
              disabled={!hasEditPermission}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {row.original.role === "sub_admin" && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => hasEditPermission && router.push(`/dashboard/admins/${row.original.id}/edit?tab=permissions`)}
                disabled={!hasEditPermission}
              >
                <Lock className="mr-2 h-4 w-4 " />
                Permissions
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
              onClick={() => hasDeletePermission && setDeleteAdmin(row.original)}
              disabled={!hasDeletePermission}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<UsersRound className="mr-2 h-8 w-8" />}
        title={isSuperAdmin ? "School Admins" : "System Users"}
        description={isSuperAdmin ? "Manage admin and sub-admin users" : "Manage system users"}
        buttonIcon={<Plus className="mr-2 h-4 w-4" />}
        buttonText={isSuperAdmin ? "Add School Admin" : "Add System User"}
        onButtonClick={() => router.push("/dashboard/admins/create")}
        buttonDisabled={!hasCreatePermission}
        buttonDisabledTooltip="You don't have permission to create sub admins"
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteAdmin} onOpenChange={() => setDeleteAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Admin</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground break-words">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground break-all">
              {deleteAdmin?.email}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDeleteAdmin(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAdmin && deleteMutation.mutate(deleteAdmin.id)}
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
